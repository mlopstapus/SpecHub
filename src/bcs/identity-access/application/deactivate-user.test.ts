import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import type { UserSummary } from "../domain/user";
import { CrossOrgUserAccessError, LastActiveAdminError, NotAuthorizedError } from "../domain/user";
import { insert as insertOrg } from "../infrastructure/organizations-repo";
import { insert as insertTeam } from "../infrastructure/teams-repo";
import { findById } from "../infrastructure/users-repo";
import { insertValidatedUser } from "./insert-validated-user";
import { deactivateUser } from "./deactivate-user";

async function makeOrgWithTeam(testDb: TestDb) {
  const { id: organizationId } = await insertOrg(testDb.appDb, {
    name: "Acme",
    slug: `acme-${randomUUID()}`,
  });
  const { id: teamId } = await insertTeam(testDb.appDb, {
    organizationId,
    name: "Root",
    slug: `root-${randomUUID()}`,
  });
  return { organizationId, teamId };
}

async function makeUser(
  testDb: TestDb,
  organizationId: string,
  teamId: string,
  role: "admin" | "member" = "member",
): Promise<UserSummary> {
  const { id } = await insertValidatedUser(testDb.appDb, {
    organizationId,
    teamId,
    username: `user-${randomUUID()}`,
    displayName: "Some User",
    email: `user-${randomUUID()}@example.com`,
    password: "password123",
    role,
  });
  const row = await findById(testDb.appDb, id);
  if (!row) {
    throw new Error("fixture setup failed");
  }
  return {
    id: row.id,
    orgId: row.organizationId,
    teamId: row.teamId,
    role: row.role as "admin" | "member",
    email: row.email,
  };
}

describe("deactivateUser", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("deactivates a non-last-admin user, retaining the row", async () => {
    const { organizationId, teamId } = await makeOrgWithTeam(testDb);
    const admin = await makeUser(testDb, organizationId, teamId, "admin");
    const otherAdmin = await makeUser(testDb, organizationId, teamId, "admin");

    await deactivateUser(testDb.appDb, admin, otherAdmin.id);

    const row = await findById(testDb.appDb, otherAdmin.id);
    expect(row?.isActive).toBe(false);
  });

  it("rejects a non-admin caller", async () => {
    const { organizationId, teamId } = await makeOrgWithTeam(testDb);
    const nonAdmin = await makeUser(testDb, organizationId, teamId, "member");
    const target = await makeUser(testDb, organizationId, teamId, "member");

    await expect(
      deactivateUser(testDb.appDb, nonAdmin, target.id),
    ).rejects.toThrow(NotAuthorizedError);
  });

  it("rejects deactivating the organization's last remaining active admin", async () => {
    const { organizationId, teamId } = await makeOrgWithTeam(testDb);
    const soleAdmin = await makeUser(testDb, organizationId, teamId, "admin");

    await expect(
      deactivateUser(testDb.appDb, soleAdmin, soleAdmin.id),
    ).rejects.toThrow(LastActiveAdminError);

    const row = await findById(testDb.appDb, soleAdmin.id);
    expect(row?.isActive).toBe(true);
  });

  it("rejects a target user in a different organization", async () => {
    const orgA = await makeOrgWithTeam(testDb);
    const orgB = await makeOrgWithTeam(testDb);
    const admin = await makeUser(
      testDb,
      orgA.organizationId,
      orgA.teamId,
      "admin",
    );
    const targetInOtherOrg = await makeUser(
      testDb,
      orgB.organizationId,
      orgB.teamId,
      "member",
    );

    await expect(
      deactivateUser(testDb.appDb, admin, targetInOtherOrg.id),
    ).rejects.toThrow(CrossOrgUserAccessError);
  });
});
