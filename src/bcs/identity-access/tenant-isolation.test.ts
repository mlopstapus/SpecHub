import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { withTenantContext } from "@/shared/db/tenant-context";
import { assertCrossTenantDenied } from "@/shared/testing/tenant-isolation";
import { getOrganization } from "./application/get-organization";
import { getTeamChain } from "./application/get-team-chain";
import { getUser } from "./application/get-user";
import { insert as insertOrg } from "./infrastructure/organizations-repo";
import { insert as insertTeam } from "./infrastructure/teams-repo";
import { insertValidatedUser } from "./application/insert-validated-user";
import {
  insert as insertInvitation,
  findByOrgAndId as findInvitationByOrgAndId,
} from "./infrastructure/invitations-repo";
import { findByOrgAndId as findApiKeyByOrgAndId } from "./infrastructure/api-keys-repo";
import { createApiKey } from "./application/create-api-key";
import { organizations, teams, users, invitations, apiKeys } from "./infrastructure/schema";
import { eq } from "drizzle-orm";

/**
 * One `describe` per resource type this bounded context owns, each proving
 * denial twice per the shared helper's contract (contracts/tenant-isolation-
 * test-helper.md, FR-006/FR-007):
 *   1. through the real, app-layer-scoped accessor (M1)
 *   2. through a raw, deliberately-unfiltered query, relying on RLS alone (M2)
 */
describe("tenant isolation (011-tenant-isolation-rls)", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  beforeEach(() => {
    // Every test here needs two organizations.
    vi.stubEnv("STRIPE_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  async function makeOrgTeamUser(name: string) {
    const { id: organizationId } = await insertOrg(testDb.authDb, {
      name,
      slug: `${name}-${randomUUID()}`,
    });
    const { id: teamId } = await insertTeam(testDb.authDb, {
      organizationId,
      name: "Root",
      slug: `root-${randomUUID()}`,
    });
    const { id: userId } = await insertValidatedUser(testDb.authDb, {
      organizationId,
      teamId,
      username: `user-${randomUUID()}`,
      displayName: "User",
      email: `user-${randomUUID()}@example.com`,
      password: "password123",
      role: "admin",
    });
    return { organizationId, teamId, userId };
  }

  describe("organizations", () => {
    it("denies cross-tenant access by id, both via getOrganization (M1) and RLS alone (M2)", async () => {
      const orgA = await makeOrgTeamUser("org-iso-a");
      const orgB = await makeOrgTeamUser("org-iso-b");

      await assertCrossTenantDenied({
        actingAsOrg: orgA.organizationId,
        resourceOwnedByOrg: orgB.organizationId,
        resourceId: orgB.organizationId,
        fetchResourceById: (id) =>
          withTenantContext(testDb.appDb, orgA.organizationId, (tx) => getOrganization(tx, id)),
      });

      await assertCrossTenantDenied({
        actingAsOrg: orgA.organizationId,
        resourceOwnedByOrg: orgB.organizationId,
        resourceId: orgB.organizationId,
        fetchResourceById: (id) =>
          withTenantContext(testDb.appDb, orgA.organizationId, async (tx) => {
            const [row] = await tx.select().from(organizations).where(eq(organizations.id, id));
            return row;
          }),
      });
    });
  });

  describe("teams", () => {
    it("denies cross-tenant access by id, both via getTeamChain (M1) and RLS alone (M2)", async () => {
      const orgA = await makeOrgTeamUser("team-iso-a");
      const orgB = await makeOrgTeamUser("team-iso-b");

      await assertCrossTenantDenied({
        actingAsOrg: orgA.organizationId,
        resourceOwnedByOrg: orgB.organizationId,
        resourceId: orgB.teamId,
        fetchResourceById: (id) =>
          withTenantContext(testDb.appDb, orgA.organizationId, (tx) =>
            getTeamChain(tx, orgA.organizationId, id),
          ),
      });

      await assertCrossTenantDenied({
        actingAsOrg: orgA.organizationId,
        resourceOwnedByOrg: orgB.organizationId,
        resourceId: orgB.teamId,
        fetchResourceById: (id) =>
          withTenantContext(testDb.appDb, orgA.organizationId, async (tx) => {
            const [row] = await tx.select().from(teams).where(eq(teams.id, id));
            return row;
          }),
      });
    });
  });

  describe("users", () => {
    it("denies cross-tenant access by id, both via getUser (M1) and RLS alone (M2)", async () => {
      const orgA = await makeOrgTeamUser("user-iso-a");
      const orgB = await makeOrgTeamUser("user-iso-b");

      await assertCrossTenantDenied({
        actingAsOrg: orgA.organizationId,
        resourceOwnedByOrg: orgB.organizationId,
        resourceId: orgB.userId,
        fetchResourceById: (id) =>
          withTenantContext(testDb.appDb, orgA.organizationId, (tx) =>
            getUser(tx, id, orgA.organizationId),
          ),
      });

      await assertCrossTenantDenied({
        actingAsOrg: orgA.organizationId,
        resourceOwnedByOrg: orgB.organizationId,
        resourceId: orgB.userId,
        fetchResourceById: (id) =>
          withTenantContext(testDb.appDb, orgA.organizationId, async (tx) => {
            const [row] = await tx.select().from(users).where(eq(users.id, id));
            return row;
          }),
      });
    });
  });

  describe("invitations", () => {
    it("denies cross-tenant access by id, both via invitations-repo.findByOrgAndId (M1) and RLS alone (M2)", async () => {
      const orgA = await makeOrgTeamUser("invite-iso-a");
      const orgB = await makeOrgTeamUser("invite-iso-b");
      const { id: invitationId } = await insertInvitation(testDb.authDb, {
        organizationId: orgB.organizationId,
        teamId: orgB.teamId,
        email: `invitee-${randomUUID()}@example.com`,
        role: "member",
        token: randomUUID(),
        invitedById: orgB.userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });

      await assertCrossTenantDenied({
        actingAsOrg: orgA.organizationId,
        resourceOwnedByOrg: orgB.organizationId,
        resourceId: invitationId,
        fetchResourceById: (id) =>
          withTenantContext(testDb.appDb, orgA.organizationId, (tx) =>
            findInvitationByOrgAndId(tx, orgA.organizationId, id),
          ),
      });

      await assertCrossTenantDenied({
        actingAsOrg: orgA.organizationId,
        resourceOwnedByOrg: orgB.organizationId,
        resourceId: invitationId,
        fetchResourceById: (id) =>
          withTenantContext(testDb.appDb, orgA.organizationId, async (tx) => {
            const [row] = await tx.select().from(invitations).where(eq(invitations.id, id));
            return row;
          }),
      });
    });
  });

  describe("api_keys", () => {
    it("denies cross-tenant access by id, both via api-keys-repo.findByOrgAndId (M1) and RLS alone (M2)", async () => {
      const orgA = await makeOrgTeamUser("apikey-iso-a");
      const orgB = await makeOrgTeamUser("apikey-iso-b");
      const { id: apiKeyId } = await withTenantContext(testDb.appDb, orgB.organizationId, (tx) =>
        createApiKey(
          tx,
          {
            id: orgB.userId,
            orgId: orgB.organizationId,
            teamId: orgB.teamId,
            role: "admin",
            email: "orgb-admin@example.com",
          },
          { name: "Org B key", scopes: ["prompts:read"] },
        ),
      );

      await assertCrossTenantDenied({
        actingAsOrg: orgA.organizationId,
        resourceOwnedByOrg: orgB.organizationId,
        resourceId: apiKeyId,
        fetchResourceById: (id) =>
          withTenantContext(testDb.appDb, orgA.organizationId, (tx) =>
            findApiKeyByOrgAndId(tx, orgA.organizationId, id),
          ),
      });

      await assertCrossTenantDenied({
        actingAsOrg: orgA.organizationId,
        resourceOwnedByOrg: orgB.organizationId,
        resourceId: apiKeyId,
        fetchResourceById: (id) =>
          withTenantContext(testDb.appDb, orgA.organizationId, async (tx) => {
            const [row] = await tx.select().from(apiKeys).where(eq(apiKeys.id, id));
            return row;
          }),
      });
    });
  });
});
