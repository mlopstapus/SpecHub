import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import type { UserSummary } from "../domain/user";
import { NotAuthorizedError } from "../domain/user";
import { insert as insertOrg } from "../infrastructure/organizations-repo";
import { insert as insertTeam } from "../infrastructure/teams-repo";
import { insert as insertUser } from "../infrastructure/users-repo";
import { insert as insertInvitation, markAccepted, markRevoked } from "../infrastructure/invitations-repo";
import { listInvitations } from "./list-invitations";

async function makeOrgTeamAdmin(testDb: TestDb) {
  const { id: organizationId } = await insertOrg(testDb.appDb, {
    name: "Acme",
    slug: `acme-${randomUUID()}`,
  });
  const { id: teamId } = await insertTeam(testDb.appDb, {
    organizationId,
    name: "Root",
    slug: `root-${randomUUID()}`,
  });
  const { id: adminId } = await insertUser(testDb.appDb, {
    organizationId,
    teamId,
    username: `admin-${randomUUID()}`,
    displayName: "Admin",
    email: `admin-${randomUUID()}@example.com`,
    passwordHash: "hash",
    role: "admin",
  });
  const admin: UserSummary = {
    id: adminId,
    orgId: organizationId,
    teamId,
    role: "admin",
    email: "admin@example.com",
  };
  return { organizationId, teamId, admin };
}

async function makeInvitation(
  testDb: TestDb,
  fixture: { organizationId: string; teamId: string; admin: UserSummary },
  overrides: { expiresAt?: Date } = {},
) {
  const { id } = await insertInvitation(testDb.appDb, {
    organizationId: fixture.organizationId,
    teamId: fixture.teamId,
    email: `invitee-${randomUUID()}@example.com`,
    role: "member",
    token: randomUUID(),
    invitedById: fixture.admin.id,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60),
  });
  return id;
}

describe("listInvitations", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("returns only the caller's organization's invitations", async () => {
    const orgA = await makeOrgTeamAdmin(testDb);
    const orgB = await makeOrgTeamAdmin(testDb);
    const idA = await makeInvitation(testDb, orgA);
    const idB = await makeInvitation(testDb, orgB);

    const result = await listInvitations(testDb.appDb, orgA.admin);

    expect(result.map((r) => r.id)).toContain(idA);
    expect(result.map((r) => r.id)).not.toContain(idB);
  });

  it("represents each of the four states correctly and distinctly", async () => {
    const fixture = await makeOrgTeamAdmin(testDb);
    const pendingId = await makeInvitation(testDb, fixture);
    const acceptedId = await makeInvitation(testDb, fixture);
    await markAccepted(testDb.appDb, acceptedId);
    const expiredId = await makeInvitation(testDb, fixture, {
      expiresAt: new Date(Date.now() - 1000),
    });
    const revokedId = await makeInvitation(testDb, fixture);
    await markRevoked(testDb.appDb, revokedId);

    const result = await listInvitations(testDb.appDb, fixture.admin);
    const byId = new Map(result.map((r) => [r.id, r.state]));

    expect(byId.get(pendingId)).toBe("pending");
    expect(byId.get(acceptedId)).toBe("accepted");
    expect(byId.get(expiredId)).toBe("expired");
    expect(byId.get(revokedId)).toBe("revoked");
  });

  it("never includes the raw token in the returned shape", async () => {
    const fixture = await makeOrgTeamAdmin(testDb);
    await makeInvitation(testDb, fixture);

    const result = await listInvitations(testDb.appDb, fixture.admin);

    expect(result[0]).not.toHaveProperty("token");
  });

  it("rejects a non-admin caller", async () => {
    const fixture = await makeOrgTeamAdmin(testDb);
    const nonAdmin: UserSummary = { ...fixture.admin, role: "member" };

    await expect(listInvitations(testDb.appDb, nonAdmin)).rejects.toThrow(
      NotAuthorizedError,
    );
  });
});
