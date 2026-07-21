import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenantContext } from "./tenant-context";
import { startTestDb, type TestDb } from "./test-helpers";

/**
 * Simulates an MCP tool-handler call site — mechanically identical to a REST
 * route handler's call, since withTenantContext is transport-agnostic by
 * design (FR-004). Named separately so the transport-parity assertions read
 * as proving that, not as incidental duplication.
 */
function simulatedMcpToolHandler<T>(
  testDb: TestDb,
  organizationId: string,
  fn: Parameters<typeof withTenantContext<T, Record<string, never>>>[2],
): Promise<T> {
  return withTenantContext(testDb.appDb, organizationId, fn);
}

describe("withTenantContext / RLS enforcement", () => {
  let testDb: TestDb;
  const orgA = randomUUID();
  const orgB = randomUUID();

  beforeAll(async () => {
    testDb = await startTestDb();
    await testDb.ownerDb.execute(sql`
      create table if not exists distribution.tenant_isolation_smoke_test (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);
    await testDb.ownerDb.execute(
      sql`alter table distribution.tenant_isolation_smoke_test enable row level security`,
    );
    await testDb.ownerDb.execute(sql`
      create policy tenant_isolation on distribution.tenant_isolation_smoke_test
        using (organization_id = current_setting('app.current_org_id')::uuid)
    `);
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("insert via withTenantContext(orgA) lands with organization_id = orgA", async () => {
    await withTenantContext(testDb.appDb, orgA, async (tx) => {
      await tx.execute(
        sql`insert into distribution.tenant_isolation_smoke_test (organization_id) values (${orgA})`,
      );
    });
    const rows = await withTenantContext(testDb.appDb, orgA, (tx) =>
      tx.execute<{ organization_id: string }>(
        sql`select organization_id from distribution.tenant_isolation_smoke_test`,
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.organization_id).toBe(orgA);
  });

  it("querying under orgB's context returns no rows", async () => {
    const rows = await withTenantContext(testDb.appDb, orgB, (tx) =>
      tx.execute(sql`select * from distribution.tenant_isolation_smoke_test`),
    );
    expect(rows).toHaveLength(0);
  });

  it("querying with no tenant context established is denied outright, not just empty", async () => {
    await expect(
      testDb.appDb.execute(
        sql`select * from distribution.tenant_isolation_smoke_test`,
      ),
    ).rejects.toThrow();
  });

  it("the same assertions hold via a simulated MCP-tool-handler call path", async () => {
    const orgC = randomUUID();

    // Insert via the "MCP" call path, using the tx handed to fn (not a fresh
    // top-level query) — exactly how a real MCP tool handler would use it.
    await simulatedMcpToolHandler(testDb, orgC, async (tx) => {
      await tx.execute(
        sql`insert into distribution.tenant_isolation_smoke_test (organization_id) values (${orgC})`,
      );
    });

    const viaMcp = await simulatedMcpToolHandler(testDb, orgC, (tx) =>
      tx.execute<{ organization_id: string }>(
        sql`select organization_id from distribution.tenant_isolation_smoke_test where organization_id = ${orgC}`,
      ),
    );
    expect(viaMcp).toHaveLength(1);
    expect(viaMcp[0]?.organization_id).toBe(orgC);

    // No-context denial holds identically on the "MCP" path too.
    await expect(
      testDb.appDb.execute(
        sql`select * from distribution.tenant_isolation_smoke_test where organization_id = ${orgC}`,
      ),
    ).rejects.toThrow();
  });

  it("the owner/migration role is NOT denied on the same no-context query — exactly why role separation (FR-010) matters, not a case the kernel guards against", async () => {
    const rows = await testDb.ownerDb.execute(
      sql`select * from distribution.tenant_isolation_smoke_test`,
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("a connection reused from the pool after a withTenantContext transaction does not retain the prior tenant's setting", async () => {
    const orgD = randomUUID();
    await withTenantContext(testDb.appDb, orgD, async (tx) => {
      await tx.execute(
        sql`insert into distribution.tenant_isolation_smoke_test (organization_id) values (${orgD})`,
      );
    });
    // A later, unrelated query with no tenant context established must still
    // be denied — if orgD's setting leaked onto the reused connection this
    // would (wrongly) succeed and return orgD-scoped rows instead of erroring.
    await expect(
      testDb.appDb.execute(
        sql`select * from distribution.tenant_isolation_smoke_test`,
      ),
    ).rejects.toThrow();
  });

  it("if fn throws inside withTenantContext, the transaction rolls back and no partial write lands", async () => {
    const orgE = randomUUID();
    await expect(
      withTenantContext(testDb.appDb, orgE, async (tx) => {
        await tx.execute(
          sql`insert into distribution.tenant_isolation_smoke_test (organization_id) values (${orgE})`,
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const rows = await withTenantContext(testDb.appDb, orgE, (tx) =>
      tx.execute(
        sql`select * from distribution.tenant_isolation_smoke_test where organization_id = ${orgE}`,
      ),
    );
    expect(rows).toHaveLength(0);
  });

  it("a withTenantContext round-trip succeeds using the prepare:false client (PgBouncer transaction-mode compatibility, FR-011)", async () => {
    const orgF = randomUUID();
    await withTenantContext(testDb.appDb, orgF, async (tx) => {
      await tx.execute(
        sql`insert into distribution.tenant_isolation_smoke_test (organization_id) values (${orgF})`,
      );
    });
    const rows = await withTenantContext(testDb.appDb, orgF, (tx) =>
      tx.execute<{ organization_id: string }>(
        sql`select organization_id from distribution.tenant_isolation_smoke_test where organization_id = ${orgF}`,
      ),
    );
    expect(rows).toHaveLength(1);
  });
});
