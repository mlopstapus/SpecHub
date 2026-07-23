import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { insert as insertOrg } from "./organizations-repo";
import { insert as insertTeam } from "./teams-repo";
import { insert as insertUser } from "./users-repo";
import { insert, markAccepted } from "./invitations-repo";

async function makeFixture(testDb: TestDb) {
  const { id: organizationId } = await insertOrg(testDb.appDb, {
    name: "Acme",
    slug: `acme-${randomUUID()}`,
  });
  const { id: teamId } = await insertTeam(testDb.appDb, {
    organizationId,
    name: "Root",
    slug: `root-${randomUUID()}`,
  });
  const { id: invitedById } = await insertUser(testDb.appDb, {
    organizationId,
    teamId,
    username: `admin-${randomUUID()}`,
    displayName: "Admin",
    email: `admin-${randomUUID()}@example.com`,
    passwordHash: "hash",
    role: "admin",
  });
  const { id } = await insert(testDb.appDb, {
    organizationId,
    teamId,
    email: `new.hire-${randomUUID()}@example.com`,
    role: "member",
    token: randomUUID(),
    invitedById,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  });
  return { organizationId, teamId, invitedById, invitationId: id };
}

describe("invitations-repo.markAccepted", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("marks a pending invitation accepted and returns the updated row", async () => {
    const { invitationId } = await makeFixture(testDb);

    const row = await markAccepted(testDb.appDb, invitationId);

    expect(row?.acceptedAt).toBeInstanceOf(Date);
  });

  it("returns no row on a second call — the conditional update excludes an already-accepted row", async () => {
    const { invitationId } = await makeFixture(testDb);

    await markAccepted(testDb.appDb, invitationId);
    const second = await markAccepted(testDb.appDb, invitationId);

    expect(second).toBeUndefined();
  });
});
