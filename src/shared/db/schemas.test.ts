import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCHEMAS } from "./schemas";
import { startTestDb, type TestDb } from "./test-helpers";

describe("schema migration", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("creates all seven bounded-context schemas", async () => {
    const names = Object.values(SCHEMAS);
    const rows = await testDb.ownerDb.execute<{ schema_name: string }>(
      sql`select schema_name from information_schema.schemata where schema_name in (${sql.join(
        names.map((n) => sql`${n}`),
        sql`, `,
      )})`,
    );
    const found = rows.map((r) => r.schema_name).sort();
    expect(found).toEqual(names.sort());
  });

  it("re-running the migration against the same instance does not error", async () => {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await expect(
      migrate(testDb.ownerDb, { migrationsFolder: "./drizzle/migrations" }),
    ).resolves.not.toThrow();
  });

  it("the app role can select/insert against a throwaway table without owning the schema", async () => {
    await testDb.ownerDb.execute(
      sql`create table if not exists distribution.smoke_test (id uuid primary key default gen_random_uuid())`,
    );
    await expect(
      testDb.appDb.execute(sql`insert into distribution.smoke_test default values`),
    ).resolves.not.toThrow();
    const rows = await testDb.appDb.execute(sql`select * from distribution.smoke_test`);
    expect(rows.length).toBeGreaterThan(0);
  });
});
