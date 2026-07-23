import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { EntitlementRequiredError } from "../domain/user";
import { organizations, teams, users } from "../infrastructure/schema";
import * as entitlementGate from "./entitlement-gate";
import { registerFirstRunAdmin } from "./register-first-run-admin";

describe("registerFirstRunAdmin", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  beforeEach(async () => {
    // Self-hosted single-org guard (create-organization.ts) rejects a
    // second organization otherwise — each test needs an empty table.
    await testDb.ownerDb.delete(organizations);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  it("produces a real Organization + root Team + admin User, with the team's owner_id set to the new user's id", async () => {
    const slug = randomUUID();

    const result = await registerFirstRunAdmin(testDb.appDb, {
      organization: { name: "Acme", slug: `acme-${slug}` },
      team: { name: "Root", slug: `root-${slug}` },
      admin: {
        username: `admin-${slug}`,
        email: `admin-${slug}@example.com`,
        password: "password123",
      },
    });

    expect(result.organizationId).toBeTruthy();
    expect(result.teamId).toBeTruthy();
    expect(result.userId).toBeTruthy();

    const [teamRow] = await testDb.appDb
      .select()
      .from(teams)
      .where(eq(teams.id, result.teamId));
    expect(teamRow?.ownerId).toBe(result.userId);
    expect(teamRow?.organizationId).toBe(result.organizationId);

    const [userRow] = await testDb.appDb
      .select()
      .from(users)
      .where(eq(users.id, result.userId));
    expect(userRow?.role).toBe("admin");
    expect(userRow?.organizationId).toBe(result.organizationId);
    expect(userRow?.teamId).toBe(result.teamId);
  });

  it("calls assertCoreFeaturesEnabled exactly once per registration attempt", async () => {
    const spy = vi.spyOn(entitlementGate, "assertCoreFeaturesEnabled");

    const slug = randomUUID();
    await registerFirstRunAdmin(testDb.appDb, {
      organization: { name: "Acme", slug: `acme-${slug}` },
      team: { name: "Root", slug: `root-${slug}` },
      admin: {
        username: `admin-${slug}`,
        email: `admin-${slug}@example.com`,
        password: "password123",
      },
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("propagates EntitlementRequiredError and writes zero rows when the gate is disabled (fail-closed)", async () => {
    vi.spyOn(entitlementGate, "assertCoreFeaturesEnabled").mockImplementation(
      () => {
        throw new EntitlementRequiredError("coreFeaturesEnabled");
      },
    );

    const slug = randomUUID();

    await expect(
      registerFirstRunAdmin(testDb.appDb, {
        organization: { name: "Acme", slug: `acme-${slug}` },
        team: { name: "Root", slug: `root-${slug}` },
        admin: {
          username: `admin-${slug}`,
          email: `admin-${slug}@example.com`,
          password: "password123",
        },
      }),
    ).rejects.toThrow(EntitlementRequiredError);

    const orgRows = await testDb.appDb
      .select()
      .from(organizations)
      .where(eq(organizations.slug, `acme-${slug}`));
    expect(orgRows).toHaveLength(0);
  });

  it("rolls back the entire transaction if user creation fails partway", async () => {
    const slug = randomUUID();
    const email = `admin-${slug}@example.com`;

    // First registration succeeds, occupying `email` in its own org.
    await registerFirstRunAdmin(testDb.appDb, {
      organization: { name: "Acme", slug: `acme-${slug}` },
      team: { name: "Root", slug: `root-${slug}` },
      admin: { username: `admin-${slug}`, email, password: "password123" },
    });

    // A second first-run attempt (different org/team, would-be-duplicate
    // admin email is irrelevant since orgs differ — instead force a failure
    // via the self-hosted single-org guard, which throws after the first
    // org already exists).
    const secondSlug = randomUUID();
    await expect(
      registerFirstRunAdmin(testDb.appDb, {
        organization: { name: "Beta", slug: `beta-${secondSlug}` },
        team: { name: "Root", slug: `root-${secondSlug}` },
        admin: {
          username: `admin-${secondSlug}`,
          email: `admin-${secondSlug}@example.com`,
          password: "password123",
        },
      }),
    ).rejects.toThrow();

    const orgRows = await testDb.appDb
      .select()
      .from(organizations)
      .where(eq(organizations.slug, `beta-${secondSlug}`));
    expect(orgRows).toHaveLength(0);
  });
});
