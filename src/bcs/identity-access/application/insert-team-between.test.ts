import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { createOrganization } from "./create-organization";
import { createTeam } from "./create-team";
import { insertTeamBetween } from "./insert-team-between";
import { teams } from "../infrastructure/schema";
import { eq } from "drizzle-orm";

describe("insertTeamBetween", () => {
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

  async function makeOrg(name: string) {
    return testDb.appDb.transaction((tx) =>
      createOrganization(tx, { name, slug: `${name}-${randomUUID()}` }),
    );
  }

  it("splices a new team into an existing parent-child link", async () => {
    const org = await makeOrg("org-splice");
    const grandparent = await testDb.appDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Engineering", slug: "engineering" }),
    );
    const child = await testDb.appDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Platform",
        slug: "platform",
        parentTeamId: grandparent.id,
      }),
    );

    const inserted = await testDb.appDb.transaction((tx) =>
      insertTeamBetween(
        tx,
        { organizationId: org.id, name: "Backend", slug: "backend" },
        child.id,
      ),
    );

    const [newRow] = await testDb.appDb.select().from(teams).where(eq(teams.id, inserted.id));
    const [childRow] = await testDb.appDb.select().from(teams).where(eq(teams.id, child.id));
    expect(newRow?.parentTeamId).toBe(grandparent.id);
    expect(childRow?.parentTeamId).toBe(inserted.id);
  });

  it("when the child is root-level, the new team becomes the new root", async () => {
    const org = await makeOrg("org-splice-root");
    const child = await testDb.appDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Root Team", slug: "root-team" }),
    );

    const inserted = await testDb.appDb.transaction((tx) =>
      insertTeamBetween(
        tx,
        { organizationId: org.id, name: "New Root", slug: "new-root" },
        child.id,
      ),
    );

    const [newRow] = await testDb.appDb.select().from(teams).where(eq(teams.id, inserted.id));
    const [childRow] = await testDb.appDb.select().from(teams).where(eq(teams.id, child.id));
    expect(newRow?.parentTeamId).toBeNull();
    expect(childRow?.parentTeamId).toBe(inserted.id);
  });

  it("rejects a nonexistent child team, no team created", async () => {
    const org = await makeOrg("org-splice-missing");
    const uniqueSlug = `backend-${randomUUID()}`;

    await expect(
      testDb.appDb.transaction((tx) =>
        insertTeamBetween(
          tx,
          { organizationId: org.id, name: "Backend", slug: uniqueSlug },
          randomUUID(),
        ),
      ),
    ).rejects.toThrow();

    const rows = await testDb.appDb.select().from(teams).where(eq(teams.slug, uniqueSlug));
    expect(rows).toHaveLength(0);
  });

  it("leaves every other team in a larger hierarchy unaffected", async () => {
    const org = await makeOrg("org-splice-isolated");
    const root = await testDb.appDb.transaction((tx) =>
      createTeam(tx, { organizationId: org.id, name: "Root", slug: "root" }),
    );
    const sibling = await testDb.appDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Sibling",
        slug: "sibling",
        parentTeamId: root.id,
      }),
    );
    const child = await testDb.appDb.transaction((tx) =>
      createTeam(tx, {
        organizationId: org.id,
        name: "Child",
        slug: "child",
        parentTeamId: root.id,
      }),
    );

    await testDb.appDb.transaction((tx) =>
      insertTeamBetween(
        tx,
        { organizationId: org.id, name: "Middle", slug: "middle" },
        child.id,
      ),
    );

    const [siblingRow] = await testDb.appDb.select().from(teams).where(eq(teams.id, sibling.id));
    const [rootRow] = await testDb.appDb.select().from(teams).where(eq(teams.id, root.id));
    expect(siblingRow?.parentTeamId).toBe(root.id);
    expect(rootRow?.parentTeamId).toBeNull();
  });
});
