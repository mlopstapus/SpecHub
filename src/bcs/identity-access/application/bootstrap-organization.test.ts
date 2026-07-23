import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { bootstrapOrganization } from "./bootstrap-organization";
import { getOrganization } from "./get-organization";
import { organizations } from "../infrastructure/schema";

describe("bootstrapOrganization", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  // Each test needs a genuinely empty `organizations` table (spec.md US1's
  // "fresh self-hosted install with zero organizations" precondition) — the
  // self-hosted single-org guard (FR-006) would otherwise reject the second
  // test's attempt using a row left over from the first.
  beforeEach(async () => {
    await testDb.ownerDb.delete(organizations);
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  it("creates one Organization row and invokes provisionTeamAndAdmin with its id", async () => {
    let receivedOrganizationId: string | undefined;
    const stubTeamId = randomUUID();
    const stubUserId = randomUUID();

    const result = await bootstrapOrganization(
      testDb.appDb,
      { name: "Acme", slug: `acme-${randomUUID()}` },
      async (_tx, organizationId) => {
        receivedOrganizationId = organizationId;
        return { teamId: stubTeamId, userId: stubUserId };
      },
    );

    expect(result.organizationId).toBeTruthy();
    expect(receivedOrganizationId).toBe(result.organizationId);
    expect(result.teamId).toBe(stubTeamId);
    expect(result.userId).toBe(stubUserId);

    const summary = await getOrganization(testDb.appDb, result.organizationId);
    expect(summary.name).toBe("Acme");
  });

  it("rolls back the Organization insert if provisionTeamAndAdmin throws", async () => {
    const slug = `broken-${randomUUID()}`;

    await expect(
      bootstrapOrganization(
        testDb.appDb,
        { name: "Broken Co", slug },
        async () => {
          throw new Error("team/admin provisioning failed");
        },
      ),
    ).rejects.toThrow("team/admin provisioning failed");

    const rows = await testDb.appDb
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug));
    expect(rows).toHaveLength(0);
  });
});
