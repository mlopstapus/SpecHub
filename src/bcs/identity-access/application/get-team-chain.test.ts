import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { withTenantContext } from "@/shared/db/tenant-context";
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
    const org = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, { name: "org-chain", slug: `org-chain-${randomUUID()}` }),
    );
    const root = await testDb.authDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Root", slug: "root" }),
    );
    const mid = await testDb.authDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Mid",
        slug: "mid",
        parentTeamId: root.id,
      }),
    );
    const leaf = await testDb.authDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Leaf",
        slug: "leaf",
        parentTeamId: mid.id,
      }),
    );
    const bottom = await testDb.authDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Bottom",
        slug: "bottom",
        parentTeamId: leaf.id,
      }),
    );

    const chain = await withTenantContext(testDb.appDb, org.id, (tx) =>
      getTeamChain(tx, org.id, bottom.id),
    );

    expect(chain.map((entry) => entry.name)).toEqual(["Bottom", "Leaf", "Mid", "Root"]);
    expect(chain[0]?.id).toBe(bottom.id);
    expect(chain[0]?.parentTeamId).toBe(leaf.id);
    expect(chain[3]?.id).toBe(root.id);
    expect(chain[3]?.parentTeamId).toBeNull();
  });

  it("returns only itself for a root-level team with no parent", async () => {
    const org = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, { name: "org-root-only", slug: `org-root-only-${randomUUID()}` }),
    );
    const root = await testDb.authDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Solo", slug: "solo" }),
    );

    const chain = await withTenantContext(testDb.appDb, org.id, (tx) =>
      getTeamChain(tx, org.id, root.id),
    );

    expect(chain).toHaveLength(1);
    expect(chain[0]?.id).toBe(root.id);
    expect(chain[0]?.parentTeamId).toBeNull();
  });

  it("throws for a nonexistent team", async () => {
    const org = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, { name: "org-missing", slug: `org-missing-${randomUUID()}` }),
    );
    await expect(
      withTenantContext(testDb.appDb, org.id, (tx) =>
        getTeamChain(tx, org.id, randomUUID()),
      ),
    ).rejects.toThrow();
  });

  it("throws for a team id that belongs to a different organization (M1/M3)", async () => {
    const orgA = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, { name: "org-chain-a", slug: `org-chain-a-${randomUUID()}` }),
    );
    const orgB = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, { name: "org-chain-b", slug: `org-chain-b-${randomUUID()}` }),
    );
    const teamInB = await testDb.authDb.transaction((tx) =>
      createTeam(tx, { organizationId: orgB.id, name: "B Team", slug: "b-team" }),
    );

    await expect(
      withTenantContext(testDb.appDb, orgA.id, (tx) =>
        getTeamChain(tx, orgA.id, teamInB.id),
      ),
    ).rejects.toThrow();
  });
});
