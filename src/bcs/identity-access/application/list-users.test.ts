import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import type { UserSummary } from "../domain/user";
import { insert as insertOrg } from "../infrastructure/organizations-repo";
import { insert as insertTeam } from "../infrastructure/teams-repo";
import { insertValidatedUser } from "./insert-validated-user";
import { listUsers } from "./list-users";

async function makeOrgWithTeam(testDb: TestDb, name = "Root") {
  const { id: organizationId } = await insertOrg(testDb.appDb, {
    name: "Acme",
    slug: `acme-${randomUUID()}`,
  });
  const { id: teamId } = await insertTeam(testDb.appDb, {
    organizationId,
    name,
    slug: `${name.toLowerCase()}-${randomUUID()}`,
  });
  return { organizationId, teamId };
}

async function makeUser(testDb: TestDb, organizationId: string, teamId: string) {
  return insertValidatedUser(testDb.appDb, {
    organizationId,
    teamId,
    username: `user-${randomUUID()}`,
    displayName: "Some User",
    email: `user-${randomUUID()}@example.com`,
    password: "password123",
    role: "member",
  });
}

describe("listUsers", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("returns only the caller's own organization's users", async () => {
    const orgA = await makeOrgWithTeam(testDb);
    const orgB = await makeOrgWithTeam(testDb);
    const userA = await makeUser(testDb, orgA.organizationId, orgA.teamId);
    await makeUser(testDb, orgB.organizationId, orgB.teamId);

    const acting: UserSummary = {
      id: userA.id,
      orgId: orgA.organizationId,
      teamId: orgA.teamId,
      role: "member",
      email: "acting@example.com",
    };

    const result = await listUsers(testDb.appDb, acting);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(userA.id);
  });

  it("filters correctly by teamId when given", async () => {
    const org = await makeOrgWithTeam(testDb, "TeamOne");
    const { id: teamTwoId } = await insertTeam(testDb.appDb, {
      organizationId: org.organizationId,
      name: "TeamTwo",
      slug: `teamtwo-${randomUUID()}`,
    });
    const userInTeamOne = await makeUser(testDb, org.organizationId, org.teamId);
    await makeUser(testDb, org.organizationId, teamTwoId);

    const acting: UserSummary = {
      id: userInTeamOne.id,
      orgId: org.organizationId,
      teamId: org.teamId,
      role: "member",
      email: "acting@example.com",
    };

    const result = await listUsers(testDb.appDb, acting, { teamId: org.teamId });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(userInTeamOne.id);
  });

  it("returns all org users across teams when no filter is given", async () => {
    const org = await makeOrgWithTeam(testDb, "TeamOne");
    const { id: teamTwoId } = await insertTeam(testDb.appDb, {
      organizationId: org.organizationId,
      name: "TeamTwo",
      slug: `teamtwo-${randomUUID()}`,
    });
    await makeUser(testDb, org.organizationId, org.teamId);
    await makeUser(testDb, org.organizationId, teamTwoId);

    const acting: UserSummary = {
      id: randomUUID(),
      orgId: org.organizationId,
      teamId: org.teamId,
      role: "member",
      email: "acting@example.com",
    };

    const result = await listUsers(testDb.appDb, acting);

    expect(result).toHaveLength(2);
  });

  it("never includes password_hash in the returned shape", async () => {
    const org = await makeOrgWithTeam(testDb);
    const user = await makeUser(testDb, org.organizationId, org.teamId);
    const acting: UserSummary = {
      id: user.id,
      orgId: org.organizationId,
      teamId: org.teamId,
      role: "member",
      email: "acting@example.com",
    };

    const result = await listUsers(testDb.appDb, acting);

    for (const row of result) {
      expect(Object.keys(row)).not.toContain("passwordHash");
      expect(Object.keys(row)).not.toContain("password_hash");
    }
  });
});
