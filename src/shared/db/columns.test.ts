import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { id, organizationId, timestamps } from "./columns";
import { distributionSchema } from "./schemas";
import { startTestDb, type TestDb } from "./test-helpers";

const tenantScopedTable = distributionSchema.table("column_smoke_test", {
  id: id(),
  organizationId: organizationId(),
  ...timestamps(),
});

const globalTable = distributionSchema.table("column_smoke_test_global", {
  id: id(),
  ...timestamps(),
});

describe("standard column builders", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();

    // Diff an empty snapshot against one containing the two throwaway
    // tables, then execute the resulting DDL directly — avoids drizzle-kit's
    // interactive `pushSchema` helper, which calls process.exit() outside a
    // TTY (not viable inside a test runner).
    const prev = generateDrizzleJson({}, undefined, ["distribution"]);
    const cur = generateDrizzleJson(
      { tenantScopedTable, globalTable },
      prev.id,
      ["distribution"],
    );
    const statements = await generateMigration(prev, cur);
    for (const statement of statements) {
      await testDb.ownerDb.execute(sql.raw(statement));
    }
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("id(), organizationId(), timestamps() produce the conventioned columns", async () => {
    const rows = await testDb.ownerDb.execute<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      sql`select column_name, data_type, is_nullable, column_default
          from information_schema.columns
          where table_schema = 'distribution' and table_name = 'column_smoke_test'
          order by column_name`,
    );
    const column = (name: string) => {
      const found = rows.find((r) => r.column_name === name);
      expect(found).toBeDefined();
      return found as NonNullable<typeof found>;
    };

    expect(column("id").data_type).toBe("uuid");
    expect(column("id").column_default).toMatch(/gen_random_uuid/);

    expect(column("organization_id").data_type).toBe("uuid");
    expect(column("organization_id").is_nullable).toBe("NO");

    expect(column("created_at").data_type).toBe("timestamp with time zone");
    expect(column("created_at").column_default).toMatch(/now\(\)/);
    expect(column("updated_at").data_type).toBe("timestamp with time zone");
    expect(column("updated_at").column_default).toMatch(/now\(\)/);
  });

  it("a genuinely global table can omit organizationId() and still migrate successfully", async () => {
    const rows = await testDb.ownerDb.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
          where table_schema = 'distribution' and table_name = 'column_smoke_test_global'`,
    );
    const names = rows.map((r) => r.column_name);
    expect(names).not.toContain("organization_id");
    expect(names).toEqual(expect.arrayContaining(["id", "created_at", "updated_at"]));
  });
});
