import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";
import { withTenantContext } from "@/shared/db/tenant-context";
import { createOrganization } from "./create-organization";
import { getOrganization } from "./get-organization";

describe("getOrganization", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("returns the OrgSummary shape only — no stripe_customer_id or timestamps", async () => {
    const { id } = await testDb.authDb.transaction((tx) =>
      createOrganization(tx, {
        name: "Acme",
        slug: `acme-${randomUUID()}`,
      }),
    );

    const summary = await withTenantContext(testDb.appDb, id, (tx) =>
      getOrganization(tx, id),
    );

    expect(summary).toEqual({
      id,
      name: "Acme",
      slug: expect.stringContaining("acme-"),
      planId: null,
    });
    expect(summary).not.toHaveProperty("stripeCustomerId");
    expect(summary).not.toHaveProperty("createdAt");
    expect(summary).not.toHaveProperty("updatedAt");
  });

  it("throws for an unknown organization id", async () => {
    const unknownId = randomUUID();
    await expect(
      withTenantContext(testDb.appDb, unknownId, (tx) => getOrganization(tx, unknownId)),
    ).rejects.toThrow();
  });
});
