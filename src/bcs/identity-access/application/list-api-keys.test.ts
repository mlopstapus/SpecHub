import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { withTenantContext } from "@/shared/db/tenant-context";
import { NotAuthorizedError, CrossOrgUserAccessError, type UserSummary } from "../domain/user";
import { insert as insertOrg } from "../infrastructure/organizations-repo";
import { insert as insertTeam } from "../infrastructure/teams-repo";
import { insert as insertUser } from "../infrastructure/users-repo";
import { createApiKey } from "./create-api-key";
import { listApiKeys } from "./list-api-keys";

async function makeOrgWithTeam(testDb: TestDb) {
  const { id: organizationId } = await insertOrg(testDb.authDb, {
    name: "Acme",
    slug: `acme-${randomUUID()}`,
  });
  const { id: teamId } = await insertTeam(testDb.authDb, {
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
  const email = `user-${randomUUID()}@example.com`;
  const { id } = await insertUser(testDb.authDb, {
    organizationId,
    teamId,
    username: `user-${randomUUID()}`,
    displayName: "User",
    email,
    passwordHash: "hash",
    role,
  });
  return { id, orgId: organizationId, teamId, role, email };
}

describe("listApiKeys", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("with no targetUserId, returns only the caller's own keys with no keyHash/raw value", async () => {
    const { organizationId, teamId } = await makeOrgWithTeam(testDb);
    const user = await makeUser(testDb, organizationId, teamId, "member");
    const otherUser = await makeUser(testDb, organizationId, teamId, "member");
    await withTenantContext(testDb.appDb, organizationId, (tx) =>
      createApiKey(tx, otherUser, { name: "Not mine", scopes: ["prompts:read"] }),
    );
    await withTenantContext(testDb.appDb, organizationId, (tx) =>
      createApiKey(tx, user, { name: "Key A", scopes: ["prompts:read"] }),
    );
    await withTenantContext(testDb.appDb, organizationId, (tx) =>
      createApiKey(tx, user, { name: "Key B", scopes: ["workflows:read"] }),
    );

    const result = await withTenantContext(testDb.appDb, organizationId, (tx) =>
      listApiKeys(tx, user),
    );

    expect(result).toHaveLength(2);
    expect(result.every((k) => k.userId === user.id)).toBe(true);
    for (const key of result) {
      expect(key).not.toHaveProperty("keyHash");
      expect(key).not.toHaveProperty("rawKey");
    }
  });

  it("allows an org admin to list another user's keys in the same organization", async () => {
    const { organizationId, teamId } = await makeOrgWithTeam(testDb);
    const admin = await makeUser(testDb, organizationId, teamId, "admin");
    const otherUser = await makeUser(testDb, organizationId, teamId, "member");
    await withTenantContext(testDb.appDb, organizationId, (tx) =>
      createApiKey(tx, otherUser, { name: "Their key", scopes: ["prompts:read"] }),
    );

    const result = await withTenantContext(testDb.appDb, organizationId, (tx) =>
      listApiKeys(tx, admin, otherUser.id),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.userId).toBe(otherUser.id);
  });

  it("rejects a non-admin attempting to list someone else's keys", async () => {
    const { organizationId, teamId } = await makeOrgWithTeam(testDb);
    const member = await makeUser(testDb, organizationId, teamId, "member");
    const otherUser = await makeUser(testDb, organizationId, teamId, "member");

    await expect(
      withTenantContext(testDb.appDb, organizationId, (tx) =>
        listApiKeys(tx, member, otherUser.id),
      ),
    ).rejects.toThrow(NotAuthorizedError);
  });

  it("rejects an admin passing a targetUserId belonging to a different organization", async () => {
    const orgA = await makeOrgWithTeam(testDb);
    const orgB = await makeOrgWithTeam(testDb);
    const admin = await makeUser(testDb, orgA.organizationId, orgA.teamId, "admin");
    const otherOrgUser = await makeUser(testDb, orgB.organizationId, orgB.teamId, "member");

    await expect(
      withTenantContext(testDb.appDb, orgA.organizationId, (tx) =>
        listApiKeys(tx, admin, otherOrgUser.id),
      ),
    ).rejects.toThrow(CrossOrgUserAccessError);
  });

  it("never includes keys from a different organization", async () => {
    const orgA = await makeOrgWithTeam(testDb);
    const orgB = await makeOrgWithTeam(testDb);
    const userA = await makeUser(testDb, orgA.organizationId, orgA.teamId, "member");
    const userB = await makeUser(testDb, orgB.organizationId, orgB.teamId, "member");
    await withTenantContext(testDb.appDb, orgA.organizationId, (tx) =>
      createApiKey(tx, userA, { name: "A's key", scopes: ["prompts:read"] }),
    );
    await withTenantContext(testDb.appDb, orgB.organizationId, (tx) =>
      createApiKey(tx, userB, { name: "B's key", scopes: ["prompts:read"] }),
    );

    const result = await withTenantContext(testDb.appDb, orgA.organizationId, (tx) =>
      listApiKeys(tx, userA),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.userId).toBe(userA.id);
  });
});
