import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { createOrganization } from "./create-organization";
import { createTeam } from "./create-team";
import { listSubTeams } from "./list-sub-teams";

describe("listSubTeams", () => {
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

  it("lists an organization's root-level teams when parentTeamId is null", async () => {
    const org = await testDb.appDb.transaction((tx) =>
      createOrganization(tx, { name: "org-roots", slug: `org-roots-${randomUUID()}` }),
    );
    await testDb.appDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Engineering", slug: "engineering" }),
    );
    await testDb.appDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Sales", slug: "sales" }),
    );

    const roots = await listSubTeams(testDb.appDb, org.id, null);
    expect(roots.map((t) => t.name).sort()).toEqual(["Engineering", "Sales"]);
  });

  it("lists a team's immediate sub-teams", async () => {
    const org = await testDb.appDb.transaction((tx) =>
      createOrganization(tx, { name: "org-subs", slug: `org-subs-${randomUUID()}` }),
    );
    const parent = await testDb.appDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Engineering", slug: "engineering" }),
    );
    await testDb.appDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Platform",
        slug: "platform",
        parentTeamId: parent.id,
      }),
    );
    await testDb.appDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Product",
        slug: "product",
        parentTeamId: parent.id,
      }),
    );

    const subTeams = await listSubTeams(testDb.appDb, org.id, parent.id);
    expect(subTeams.map((t) => t.name).sort()).toEqual(["Platform", "Product"]);
  });
});
