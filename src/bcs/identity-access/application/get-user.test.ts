import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { insert as insertOrg } from "../infrastructure/organizations-repo";
import { insert as insertTeam } from "../infrastructure/teams-repo";
import { insertValidatedUser } from "./insert-validated-user";
import { getUser } from "./get-user";

describe("getUser", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("returns the exact UserSummary shape for an existing user", async () => {
    const { id: organizationId } = await insertOrg(testDb.appDb, {
      name: "Acme",
      slug: `acme-${randomUUID()}`,
    });
    const { id: teamId } = await insertTeam(testDb.appDb, {
      organizationId,
      name: "Root",
      slug: `root-${randomUUID()}`,
    });
    const { id: userId } = await insertValidatedUser(testDb.appDb, {
      organizationId,
      teamId,
      username: `jdoe-${randomUUID()}`,
      displayName: "Jane Doe",
      email: `jane-${randomUUID()}@example.com`,
      password: "password123",
      role: "admin",
    });

    const summary = await getUser(testDb.appDb, userId);

    expect(summary).toEqual({
      id: userId,
      orgId: organizationId,
      teamId,
      role: "admin",
      email: summary.email,
    });
    expect(Object.keys(summary).sort()).toEqual(
      ["email", "id", "orgId", "role", "teamId"].sort(),
    );
  });

  it("throws for a nonexistent id", async () => {
    await expect(getUser(testDb.appDb, randomUUID())).rejects.toThrow();
  });
});
