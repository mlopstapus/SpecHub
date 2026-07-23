import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { createOrganization } from "./create-organization";
import { createTeam } from "./create-team";
import { getTeamChain } from "./get-team-chain";

describe("getTeamChain", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  beforeEach(() => {
    vi.stubEnv("STRIPE_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  /**
   * Characterization test (research.md §6): mirrors the current Python
   * `team_service.get_team_chain`'s behavior for an equivalent four-level
   * hierarchy — a pure parent-pointer walk with no side effects, appending
   * [current, parent, grandparent, ...] until parent_team_id is null.
   * FR-007/SC-001 require this ordering to match exactly.
   */
  it("returns a four-level hierarchy self-first, root-last, matching the current system's ordering", async () => {
    const org = await testDb.appDb.transaction((tx) =>
      createOrganization(tx, { name: "org-chain", slug: `org-chain-${randomUUID()}` }),
    );
    const root = await testDb.appDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Root", slug: "root" }),
    );
    const mid = await testDb.appDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Mid",
        slug: "mid",
        parentTeamId: root.id,
      }),
    );
    const leaf = await testDb.appDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Leaf",
        slug: "leaf",
        parentTeamId: mid.id,
      }),
    );
    const bottom = await testDb.appDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Bottom",
        slug: "bottom",
        parentTeamId: leaf.id,
      }),
    );

    const chain = await getTeamChain(testDb.appDb, bottom.id);

    expect(chain.map((entry) => entry.name)).toEqual(["Bottom", "Leaf", "Mid", "Root"]);
    expect(chain[0]?.id).toBe(bottom.id);
    expect(chain[0]?.parentTeamId).toBe(leaf.id);
    expect(chain[3]?.id).toBe(root.id);
    expect(chain[3]?.parentTeamId).toBeNull();
  });

  it("returns only itself for a root-level team with no parent", async () => {
    const org = await testDb.appDb.transaction((tx) =>
      createOrganization(tx, { name: "org-root-only", slug: `org-root-only-${randomUUID()}` }),
    );
    const root = await testDb.appDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Solo", slug: "solo" }),
    );

    const chain = await getTeamChain(testDb.appDb, root.id);

    expect(chain).toHaveLength(1);
    expect(chain[0]?.id).toBe(root.id);
    expect(chain[0]?.parentTeamId).toBeNull();
  });

  it("throws for a nonexistent team", async () => {
    await expect(getTeamChain(testDb.appDb, randomUUID())).rejects.toThrow();
  });
});
