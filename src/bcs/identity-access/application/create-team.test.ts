import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { createOrganization } from "./create-organization";
import { createTeam } from "./create-team";
import { CrossOrgReparentError } from "../domain/team";
import { teams } from "../infrastructure/schema";
import { eq } from "drizzle-orm";

describe("createTeam", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  // Team-hierarchy tests need multiple organizations per test file — stub
  // SaaS mode so createOrganization's self-hosted single-org guard (already
  // covered by create-organization.test.ts) doesn't interfere here.
  beforeEach(() => {
    vi.stubEnv("STRIPE_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  async function makeOrg(name: string) {
    return testDb.appDb.transaction((tx) =>
      createOrganization(tx, { name, slug: `${name}-${randomUUID()}` }),
    );
  }

  it("creates a root-level team (no parent)", async () => {
    const org = await makeOrg("org-root-team");

    const result = await testDb.appDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Engineering",
        slug: "engineering",
      }),
    );

    const [row] = await testDb.appDb
      .select()
      .from(teams)
      .where(eq(teams.id, result.id));
    expect(row?.parentTeamId).toBeNull();
    expect(row?.organizationId).toBe(org.id);
  });

  it("creates a nested team under a parent in the same organization", async () => {
    const org = await makeOrg("org-nested-team");
    const parent = await testDb.appDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Engineering", slug: "eng" }),
    );

    const child = await testDb.appDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Platform",
        slug: "platform",
        parentTeamId: parent.id,
      }),
    );

    const [row] = await testDb.appDb
      .select()
      .from(teams)
      .where(eq(teams.id, child.id));
    expect(row?.parentTeamId).toBe(parent.id);
  });

  it("rejects a parent team from a different organization", async () => {
    const orgA = await makeOrg("org-a-cross");
    const orgB = await makeOrg("org-b-cross");
    const parentInB = await testDb.appDb.transaction((tx) =>
      createTeam(tx, { organizationId: orgB.id, name: "B Team", slug: "b-team" }),
    );

    await expect(
      testDb.appDb.transaction((tx) =>
        createTeam(tx, {
          organizationId: orgA.id,
          name: "A Team",
          slug: "a-team",
          parentTeamId: parentInB.id,
        }),
      ),
    ).rejects.toThrow(CrossOrgReparentError);
  });
});
