import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import type { UserSummary } from "../domain/user";
import {
  DuplicateUserError,
  InvalidTeamAssignmentError,
  NotAuthorizedError,
  WeakPasswordError,
} from "../domain/user";
import { insert as insertOrg } from "../infrastructure/organizations-repo";
import { insert as insertTeam } from "../infrastructure/teams-repo";
import { createUser } from "./create-user";

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

function adminActingUser(organizationId: string, teamId: string): UserSummary {
  return {
    id: randomUUID(),
    orgId: organizationId,
    teamId,
    role: "admin",
    email: "acting-admin@example.com",
  };
}

describe("createUser", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("allows two different organizations to each create a user with the same email", async () => {
    const orgA = await makeOrgWithTeam(testDb);
    const orgB = await makeOrgWithTeam(testDb);

    const resultA = await createUser(
      testDb.appDb,
      adminActingUser(orgA.organizationId, orgA.teamId),
      {
        teamId: orgA.teamId,
        username: `admin-${randomUUID()}`,
        email: "admin@example.com",
        password: "password123",
      },
    );
    const resultB = await createUser(
      testDb.appDb,
      adminActingUser(orgB.organizationId, orgB.teamId),
      {
        teamId: orgB.teamId,
        username: `admin-${randomUUID()}`,
        email: "admin@example.com",
        password: "password123",
      },
    );

    expect(resultA.id).toBeTruthy();
    expect(resultB.id).toBeTruthy();
    expect(resultA.id).not.toBe(resultB.id);
  });

  it("rejects a second user with the same email within one organization", async () => {
    const org = await makeOrgWithTeam(testDb);
    const acting = adminActingUser(org.organizationId, org.teamId);
    const email = `owner-${randomUUID()}@example.com`;

    await createUser(testDb.appDb, acting, {
      teamId: org.teamId,
      username: `user-${randomUUID()}`,
      email,
      password: "password123",
    });

    await expect(
      createUser(testDb.appDb, acting, {
        teamId: org.teamId,
        username: `user-${randomUUID()}`,
        email,
        password: "password123",
      }),
    ).rejects.toThrow(DuplicateUserError);
  });

  it("rejects a second user with the same username within one organization", async () => {
    const org = await makeOrgWithTeam(testDb);
    const acting = adminActingUser(org.organizationId, org.teamId);
    const username = `jsmith-${randomUUID()}`;

    await createUser(testDb.appDb, acting, {
      teamId: org.teamId,
      username,
      email: `first-${randomUUID()}@example.com`,
      password: "password123",
    });

    await expect(
      createUser(testDb.appDb, acting, {
        teamId: org.teamId,
        username,
        email: `second-${randomUUID()}@example.com`,
        password: "password123",
      }),
    ).rejects.toThrow(DuplicateUserError);
  });

  it("treats emails differing only by case as duplicates within one organization", async () => {
    const org = await makeOrgWithTeam(testDb);
    const acting = adminActingUser(org.organizationId, org.teamId);
    const slug = randomUUID();

    await createUser(testDb.appDb, acting, {
      teamId: org.teamId,
      username: `owner-${slug}`,
      email: `Owner-${slug}@example.com`,
      password: "password123",
    });

    await expect(
      createUser(testDb.appDb, acting, {
        teamId: org.teamId,
        username: `different-${slug}`,
        email: `owner-${slug}@example.com`,
        password: "password123",
      }),
    ).rejects.toThrow(DuplicateUserError);
  });

  it("rejects a non-admin actingUser", async () => {
    const org = await makeOrgWithTeam(testDb);
    const nonAdmin: UserSummary = {
      ...adminActingUser(org.organizationId, org.teamId),
      role: "member",
    };

    await expect(
      createUser(testDb.appDb, nonAdmin, {
        teamId: org.teamId,
        username: `user-${randomUUID()}`,
        email: `user-${randomUUID()}@example.com`,
        password: "password123",
      }),
    ).rejects.toThrow(NotAuthorizedError);
  });

  it("rejects a teamId belonging to a different organization", async () => {
    const orgA = await makeOrgWithTeam(testDb);
    const orgB = await makeOrgWithTeam(testDb);
    const acting = adminActingUser(orgA.organizationId, orgA.teamId);

    await expect(
      createUser(testDb.appDb, acting, {
        teamId: orgB.teamId,
        username: `user-${randomUUID()}`,
        email: `user-${randomUUID()}@example.com`,
        password: "password123",
      }),
    ).rejects.toThrow(InvalidTeamAssignmentError);
  });

  it("rejects a password under 8 characters, writing no row", async () => {
    const org = await makeOrgWithTeam(testDb);
    const acting = adminActingUser(org.organizationId, org.teamId);

    await expect(
      createUser(testDb.appDb, acting, {
        teamId: org.teamId,
        username: `user-${randomUUID()}`,
        email: `user-${randomUUID()}@example.com`,
        password: "short1",
      }),
    ).rejects.toThrow(WeakPasswordError);
  });
});
