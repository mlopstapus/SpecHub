import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "./test-helpers";
import { withAudit } from "./with-audit";

describe("withAudit / mutation-audit atomicity", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
    await testDb.ownerDb.execute(sql`
      create table if not exists distribution.audit_mutation_smoke_test (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null
      )
    `);
    await testDb.ownerDb.execute(sql`
      create table if not exists distribution.audit_event_smoke_test (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null,
        event_type text not null check (event_type in ('mutation.created')),
        created_at timestamptz not null default now()
      )
    `);
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("a valid mutation + valid audit event both commit together", async () => {
    const orgId = randomUUID();
    await withAudit(
      testDb.ownerDb,
      async (tx) => {
        await tx.execute(
          sql`insert into distribution.audit_mutation_smoke_test (organization_id) values (${orgId})`,
        );
      },
      async (tx) => {
        await tx.execute(
          sql`insert into distribution.audit_event_smoke_test (organization_id, event_type) values (${orgId}, 'mutation.created')`,
        );
      },
    );

    const mutationRows = await testDb.ownerDb.execute(
      sql`select * from distribution.audit_mutation_smoke_test where organization_id = ${orgId}`,
    );
    const auditRows = await testDb.ownerDb.execute(
      sql`select * from distribution.audit_event_smoke_test where organization_id = ${orgId}`,
    );
    expect(mutationRows).toHaveLength(1);
    expect(auditRows).toHaveLength(1);
  });

  it("a forced audit-insert constraint violation rolls back the mutation too", async () => {
    const orgId = randomUUID();
    await expect(
      withAudit(
        testDb.ownerDb,
        async (tx) => {
          await tx.execute(
            sql`insert into distribution.audit_mutation_smoke_test (organization_id) values (${orgId})`,
          );
        },
        async (tx) => {
          // Violates the event_type CHECK constraint on purpose.
          await tx.execute(
            sql`insert into distribution.audit_event_smoke_test (organization_id, event_type) values (${orgId}, 'not.a.real.type')`,
          );
        },
      ),
    ).rejects.toThrow();

    const mutationRows = await testDb.ownerDb.execute(
      sql`select * from distribution.audit_mutation_smoke_test where organization_id = ${orgId}`,
    );
    expect(mutationRows).toHaveLength(0);
  });

  it("a mutation that throws also prevents the audit event from committing", async () => {
    const orgId = randomUUID();
    await expect(
      withAudit(
        testDb.ownerDb,
        async () => {
          throw new Error("mutation boom");
        },
        async (tx) => {
          await tx.execute(
            sql`insert into distribution.audit_event_smoke_test (organization_id, event_type) values (${orgId}, 'mutation.created')`,
          );
        },
      ),
    ).rejects.toThrow("mutation boom");

    const auditRows = await testDb.ownerDb.execute(
      sql`select * from distribution.audit_event_smoke_test where organization_id = ${orgId}`,
    );
    expect(auditRows).toHaveLength(0);
  });
});
