import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import * as auditCompliance from "@/bcs/audit-compliance";
import { insert as insertOrg } from "../infrastructure/organizations-repo";
import { insert as insertTeam } from "../infrastructure/teams-repo";
import { insertValidatedUser } from "./insert-validated-user";
import { logout } from "./logout";

async function makeUser(testDb: TestDb) {
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
    password: "correct-horse-battery",
    role: "member",
  });
  return userId;
}

describe("logout", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a clearing cookie descriptor", async () => {
    const userId = await makeUser(testDb);

    const { cookie } = await logout(testDb.appDb, userId);

    expect(cookie.value).toBe("");
    expect(cookie.maxAge).toBe(0);
  });

  it("writes exactly one user.logout audit event", async () => {
    const userId = await makeUser(testDb);

    await logout(testDb.appDb, userId);

    const result = await testDb.appDb.execute<{ action: string }>(
      sql`select action from audit.audit_events where actor_user_id = ${userId}`,
    );
    const rows = Array.from(result);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("user.logout");
  });

  it("succeeds twice in a row for the same user (idempotent)", async () => {
    const userId = await makeUser(testDb);

    await expect(logout(testDb.appDb, userId)).resolves.toBeTruthy();
    await expect(logout(testDb.appDb, userId)).resolves.toBeTruthy();
  });

  it("throws and returns no cookie when the audit write fails", async () => {
    const userId = await makeUser(testDb);
    vi.spyOn(auditCompliance, "record").mockRejectedValueOnce(
      new Error("audit store unavailable"),
    );

    await expect(logout(testDb.appDb, userId)).rejects.toThrow("audit store unavailable");
  });
});
