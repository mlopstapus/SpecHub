import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { withTenantContext } from "@/shared/db/tenant-context";
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
    const org = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, { name: "org-roots", slug: `org-roots-${randomUUID()}` }),
    );
    await withTenantContext(testDb.appDb, org.id, (tx) =>
      createTeam(tx, { organizationId: org.id, name: "Engineering", slug: "engineering" }),
    );
    await withTenantContext(testDb.appDb, org.id, (tx) =>
      createTeam(tx, { organizationId: org.id, name: "Sales", slug: "sales" }),
    );

    const roots = await withTenantContext(testDb.appDb, org.id, (tx) =>
      listSubTeams(tx, org.id, null),
    );
    expect(roots.map((t) => t.name).sort()).toEqual(["Engineering", "Sales"]);
  });

  it("lists a team's immediate sub-teams", async () => {
    const org = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, { name: "org-subs", slug: `org-subs-${randomUUID()}` }),
    );
    const parent = await withTenantContext(testDb.appDb, org.id, (tx) =>
      createTeam(tx, { organizationId: org.id, name: "Engineering", slug: "engineering" }),
    );
    await withTenantContext(testDb.appDb, org.id, (tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Platform",
        slug: "platform",
        parentTeamId: parent.id,
      }),
    );
    await withTenantContext(testDb.appDb, org.id, (tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Product",
        slug: "product",
        parentTeamId: parent.id,
      }),
    );

    const subTeams = await withTenantContext(testDb.appDb, org.id, (tx) =>
      listSubTeams(tx, org.id, parent.id),
    );
    expect(subTeams.map((t) => t.name).sort()).toEqual(["Platform", "Product"]);
  });
});
