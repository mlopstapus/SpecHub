import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import * as recordModule from "@/bcs/audit-compliance/application/record";
import { auditEvents } from "@/bcs/audit-compliance/infrastructure/schema";
import { insert as insertOrg } from "../infrastructure/organizations-repo";
import { insert as insertTeam } from "../infrastructure/teams-repo";
import { update as updateUserRow } from "../infrastructure/users-repo";
import { insertValidatedUser } from "./insert-validated-user";
import { login } from "./login";

async function makeOrgTeamUser(
  testDb: TestDb,
  overrides: { isActive?: boolean } = {},
) {
  const { id: organizationId } = await insertOrg(testDb.appDb, {
    name: "Acme",
    slug: `acme-${randomUUID()}`,
  });
  const { id: teamId } = await insertTeam(testDb.appDb, {
    organizationId,
    name: "Root",
    slug: `root-${randomUUID()}`,
  });
  const email = `jane-${randomUUID()}@example.com`;
  const { id: userId } = await insertValidatedUser(testDb.appDb, {
    organizationId,
    teamId,
    username: `jdoe-${randomUUID()}`,
    displayName: "Jane Doe",
    email,
    password: "correct-horse-battery",
    role: "admin",
  });
  if (overrides.isActive === false) {
    await updateUserRow(testDb.appDb, userId, { isActive: false });
  }
  return { organizationId, teamId, userId, email };
}

describe("login", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "a-real-signing-secret-for-tests");
    vi.stubEnv("JWT_EXPIRY_HOURS", "24");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns user + cookie for correct credentials, cookie flags match convention", async () => {
    const { userId, organizationId, teamId, email } = await makeOrgTeamUser(testDb);

    const result = await login(testDb.appDb, email, "correct-horse-battery");

    expect(result).not.toBeNull();
    expect(result?.user).toEqual({
      id: userId,
      orgId: organizationId,
      teamId,
      role: "admin",
      email,
    });
    expect(result?.cookie.httpOnly).toBe(true);
    expect(result?.cookie.sameSite).toBe("lax");
    expect(result?.cookie.secure).toBe(false); // NODE_ENV !== "production" in the test runner
    expect(result?.cookie.value).toBeTruthy();
  });

  it("returns null for a wrong password", async () => {
    const { email } = await makeOrgTeamUser(testDb);

    const result = await login(testDb.appDb, email, "totally-wrong-password");

    expect(result).toBeNull();
  });

  it("returns null (same shape as wrong password) for an unknown email", async () => {
    const result = await login(
      testDb.appDb,
      `nobody-${randomUUID()}@example.com`,
      "whatever-password",
    );

    expect(result).toBeNull();
  });

  it("returns null for a deactivated user with correct password", async () => {
    const { email } = await makeOrgTeamUser(testDb, { isActive: false });

    const result = await login(testDb.appDb, email, "correct-horse-battery");

    expect(result).toBeNull();
  });

  it("writes a user.login audit event on success", async () => {
    const { userId, organizationId, email } = await makeOrgTeamUser(testDb);

    await login(testDb.appDb, email, "correct-horse-battery");

    const rows = await testDb.appDb
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actorUserId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("user.login");
    expect(rows[0]?.organizationId).toBe(organizationId);
  });

  it("writes a user.login_failed audit event for a failed attempt against a real account", async () => {
    const { userId, organizationId, email } = await makeOrgTeamUser(testDb);

    await login(testDb.appDb, email, "wrong-password");

    const rows = await testDb.appDb
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actorUserId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("user.login_failed");
    expect(rows[0]?.organizationId).toBe(organizationId);
  });

  it("writes a user.login_failed audit event with null actor/org for an unknown email", async () => {
    const email = `nobody-${randomUUID()}@example.com`;

    await login(testDb.appDb, email, "whatever-password");

    const rows = await testDb.appDb
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "user.login_failed"));
    const match = rows.find((row) => row.actorUserId === null && row.organizationId === null);
    expect(match).toBeTruthy();
  });

  it("never writes the submitted password anywhere in an audit row", async () => {
    const { email } = await makeOrgTeamUser(testDb);
    const password = `super-secret-${randomUUID()}`;

    await login(testDb.appDb, email, password);

    const rows = await testDb.appDb.select().from(auditEvents);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(password);
  });

  it("propagates an error (does not return a cookie or null) when the audit write fails, on the success path", async () => {
    const { email } = await makeOrgTeamUser(testDb);
    vi.spyOn(recordModule, "record").mockRejectedValueOnce(new Error("audit store unavailable"));

    await expect(login(testDb.appDb, email, "correct-horse-battery")).rejects.toThrow(
      "audit store unavailable",
    );
  });

  it("propagates an error when the audit write fails, on a failure path", async () => {
    const { email } = await makeOrgTeamUser(testDb);
    vi.spyOn(recordModule, "record").mockRejectedValueOnce(new Error("audit store unavailable"));

    await expect(login(testDb.appDb, email, "wrong-password")).rejects.toThrow(
      "audit store unavailable",
    );
  });

  it("throws (does not return null or a cookie) when JWT_SECRET is missing, for otherwise-correct credentials", async () => {
    const { email } = await makeOrgTeamUser(testDb);
    vi.stubEnv("JWT_SECRET", "");

    await expect(login(testDb.appDb, email, "correct-horse-battery")).rejects.toThrow(
      /missing/i,
    );
  });

  it("throws when JWT_SECRET is the documented placeholder, for otherwise-correct credentials", async () => {
    const { email } = await makeOrgTeamUser(testDb);
    vi.stubEnv("JWT_SECRET", "REPLACE_ME_JWT_SECRET");

    await expect(login(testDb.appDb, email, "correct-horse-battery")).rejects.toThrow(
      /placeholder/i,
    );
  });

  it("succeeds normally once a real JWT_SECRET is restored", async () => {
    const { email } = await makeOrgTeamUser(testDb);
    vi.stubEnv("JWT_SECRET", "a-different-real-secret");

    const result = await login(testDb.appDb, email, "correct-horse-battery");

    expect(result).not.toBeNull();
  });
});
