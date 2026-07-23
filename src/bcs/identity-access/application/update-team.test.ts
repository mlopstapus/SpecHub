import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { withTenantContext } from "@/shared/db/tenant-context";
import { createOrganization } from "./create-organization";
import { createTeam } from "./create-team";
import { insertValidatedUser } from "./insert-validated-user";
import { updateTeam } from "./update-team";
import { teams } from "../infrastructure/schema";

describe("updateTeam", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  beforeEach(() => {
    vi.stubEnv("STRIPE_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  it("updates name, description, and owner without touching hierarchy position", async () => {
    const org = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, { name: "org-update", slug: `org-update-${randomUUID()}` }),
    );
    const parent = await withTenantContext(testDb.appDb, org.id, (tx) =>
      createTeam(tx, { organizationId: org.id, name: "Parent", slug: "parent" }),
    );
    const child = await withTenantContext(testDb.appDb, org.id, (tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Child",
        slug: "child",
        parentTeamId: parent.id,
      }),
    );
    // `owner_id` FK's referenced table (`identity_access.users`) didn't
    // exist when this test was originally written — a real user row is now
    // required (007-user-accounts-registration completes the FK).
    const { id: newOwnerId } = await withTenantContext(testDb.appDb, org.id, (tx) =>
      insertValidatedUser(tx, {
        organizationId: org.id,
        teamId: child.id,
        username: `owner-${randomUUID()}`,
        displayName: "New Owner",
        email: `owner-${randomUUID()}@example.com`,
        password: "password123",
        role: "member",
      }),
    );

    await withTenantContext(testDb.appDb, org.id, (tx) =>
      updateTeam(tx, org.id, child.id, {
        name: "Renamed Child",
        description: "new description",
        ownerId: newOwnerId,
      }),
    );

    const [row] = await withTenantContext(testDb.appDb, org.id, (tx) =>
      tx.select().from(teams).where(eq(teams.id, child.id)),
    );
    expect(row?.name).toBe("Renamed Child");
    expect(row?.description).toBe("new description");
    expect(row?.ownerId).toBe(newOwnerId);
    expect(row?.parentTeamId).toBe(parent.id);
  });

  it("rejects a teamId belonging to a different organization, changing nothing (M1/M3)", async () => {
    const orgA = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, { name: "org-update-a", slug: `org-update-a-${randomUUID()}` }),
    );
    const orgB = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, { name: "org-update-b", slug: `org-update-b-${randomUUID()}` }),
    );
    const teamInB = await withTenantContext(testDb.appDb, orgB.id, (tx) =>
      createTeam(tx, { organizationId: orgB.id, name: "B Team", slug: "b-team" }),
    );

    await expect(
      withTenantContext(testDb.appDb, orgA.id, (tx) =>
        updateTeam(tx, orgA.id, teamInB.id, { name: "Hijacked" }),
      ),
    ).rejects.toThrow();

    const [row] = await withTenantContext(testDb.appDb, orgB.id, (tx) =>
      tx.select().from(teams).where(eq(teams.id, teamInB.id)),
    );
    expect(row?.name).toBe("B Team");
  });
});
