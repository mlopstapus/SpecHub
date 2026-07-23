import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { insert as insertOrg } from "./organizations-repo";
import { insert as insertTeam } from "./teams-repo";
import { insert as insertUser } from "./users-repo";
import {
  findByHash,
  findByOrgAndId,
  insert,
  listByOrgAndUser,
  markRevoked,
  updateLastUsedAt,
} from "./api-keys-repo";

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
  const { id: userId } = await insertUser(testDb.appDb, {
    organizationId,
    teamId,
    username: `user-${randomUUID()}`,
    displayName: "User",
    email: `user-${randomUUID()}@example.com`,
    passwordHash: "hash",
    role: "member",
  });
  return { organizationId, teamId, userId };
}

describe("api-keys-repo", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("inserts a key and returns the generated id", async () => {
    const { organizationId, userId } = await makeFixture(testDb);

    const { id } = await insert(testDb.appDb, {
      organizationId,
      userId,
      name: "My IDE",
      keyHash: `hash-${randomUUID()}`,
      prefix: "sk_abc123",
      scopes: ["prompts:read"],
    });

    expect(id).toBeTruthy();
  });

  it("accepts an optional client-supplied id", async () => {
    const { organizationId, userId } = await makeFixture(testDb);
    const suppliedId = randomUUID();

    const { id } = await insert(testDb.appDb, {
      id: suppliedId,
      organizationId,
      userId,
      name: "My IDE",
      keyHash: `hash-${randomUUID()}`,
      prefix: "sk_abc123",
      scopes: ["prompts:read"],
    });

    expect(id).toBe(suppliedId);
  });

  it("findByHash returns the matching row", async () => {
    const { organizationId, userId } = await makeFixture(testDb);
    const keyHash = `hash-${randomUUID()}`;
    const { id } = await insert(testDb.appDb, {
      organizationId,
      userId,
      name: "My IDE",
      keyHash,
      prefix: "sk_abc123",
      scopes: ["prompts:read"],
    });

    const row = await findByHash(testDb.appDb, keyHash);

    expect(row?.id).toBe(id);
  });

  it("findByHash returns undefined for no match", async () => {
    const row = await findByHash(testDb.appDb, `nonexistent-${randomUUID()}`);
    expect(row).toBeUndefined();
  });

  it("findByOrgAndId returns undefined when the id belongs to a different organization (M3)", async () => {
    const fixtureA = await makeFixture(testDb);
    const fixtureB = await makeFixture(testDb);
    const { id } = await insert(testDb.appDb, {
      organizationId: fixtureA.organizationId,
      userId: fixtureA.userId,
      name: "My IDE",
      keyHash: `hash-${randomUUID()}`,
      prefix: "sk_abc123",
      scopes: ["prompts:read"],
    });

    const row = await findByOrgAndId(testDb.appDb, fixtureB.organizationId, id);

    expect(row).toBeUndefined();
  });

  it("listByOrgAndUser returns only that user's keys, newest first", async () => {
    const { organizationId, userId } = await makeFixture(testDb);
    const otherFixture = await makeFixture(testDb);
    await insert(testDb.appDb, {
      organizationId: otherFixture.organizationId,
      userId: otherFixture.userId,
      name: "Other user's key",
      keyHash: `hash-${randomUUID()}`,
      prefix: "sk_abc123",
      scopes: ["prompts:read"],
    });
    const { id: firstId } = await insert(testDb.appDb, {
      organizationId,
      userId,
      name: "First",
      keyHash: `hash-${randomUUID()}`,
      prefix: "sk_abc123",
      scopes: ["prompts:read"],
    });
    const { id: secondId } = await insert(testDb.appDb, {
      organizationId,
      userId,
      name: "Second",
      keyHash: `hash-${randomUUID()}`,
      prefix: "sk_abc123",
      scopes: ["prompts:read"],
    });

    const rows = await listByOrgAndUser(testDb.appDb, organizationId, userId);

    expect(rows.map((r) => r.id).sort()).toEqual([firstId, secondId].sort());
    expect(rows[0]?.id).toBe(secondId);
  });

  it("updateLastUsedAt sets last_used_at", async () => {
    const { organizationId, userId } = await makeFixture(testDb);
    const { id } = await insert(testDb.appDb, {
      organizationId,
      userId,
      name: "My IDE",
      keyHash: `hash-${randomUUID()}`,
      prefix: "sk_abc123",
      scopes: ["prompts:read"],
    });

    await updateLastUsedAt(testDb.appDb, id);
    const row = await findByOrgAndId(testDb.appDb, organizationId, id);

    expect(row?.lastUsedAt).toBeInstanceOf(Date);
  });

  it("markRevoked sets is_active to false", async () => {
    const { organizationId, userId } = await makeFixture(testDb);
    const { id } = await insert(testDb.appDb, {
      organizationId,
      userId,
      name: "My IDE",
      keyHash: `hash-${randomUUID()}`,
      prefix: "sk_abc123",
      scopes: ["prompts:read"],
    });

    await markRevoked(testDb.appDb, id);
    const row = await findByOrgAndId(testDb.appDb, organizationId, id);

    expect(row?.isActive).toBe(false);
  });
});
