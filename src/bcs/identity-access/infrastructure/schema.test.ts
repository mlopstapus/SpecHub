import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "@/shared/db/test-helpers";

describe("organizations schema (real migration)", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("has a real unique constraint on slug (FR-002)", async () => {
    const rows = await testDb.ownerDb.execute<{ constraint_type: string }>(
      sql`select tc.constraint_type
          from information_schema.table_constraints tc
          join information_schema.constraint_column_usage ccu
            on tc.constraint_name = ccu.constraint_name
           and tc.table_schema = ccu.table_schema
          where tc.table_schema = 'identity_access'
            and tc.table_name = 'organizations'
            and ccu.column_name = 'slug'
            and tc.constraint_type = 'UNIQUE'`,
    );
    expect(rows).toHaveLength(1);
  });

  it("carries no organization_id column — it is the tenant root, not a tenant-scoped table", async () => {
    const rows = await testDb.ownerDb.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
          where table_schema = 'identity_access' and table_name = 'organizations'`,
    );
    const names = rows.map((r) => r.column_name);
    expect(names).not.toContain("organization_id");
    expect(names).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "slug",
        "plan_id",
        "stripe_customer_id",
        "created_at",
        "updated_at",
      ]),
    );
  });
});
