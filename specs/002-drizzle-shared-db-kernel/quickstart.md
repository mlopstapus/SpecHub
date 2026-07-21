# Quickstart: Drizzle Shared DB Kernel

Validation guide proving the kernel works end-to-end. Not a full test suite (see `tasks.md`/the actual `*.test.ts` files for that) — just the runnable scenarios that demonstrate the spec's acceptance criteria.

## Prerequisites

- `pnpm install` (adds `drizzle-orm`, `drizzle-kit`, `postgres`, and the `testcontainers`/`@testcontainers/postgresql` dev dependency)
- Docker running locally (Testcontainers needs it to spin up ephemeral Postgres instances)
- Two environment variables available to the app: `MIGRATION_DATABASE_URL` (owner role) and `DATABASE_URL` (least-privileged runtime app role) — see `research.md`'s role-separation decision

## Scenario 1 — Fresh-database migration creates all seven schemas (User Story 1)

```bash
pnpm db:migrate
```

**Expected**: Command exits 0. Connecting with `psql "$MIGRATION_DATABASE_URL" -c '\dn'` lists `identity_access`, `governance`, `prompt_registry`, `workflow`, `billing`, `audit`, `distribution` alongside the defaults (`public`, etc).

Re-running `pnpm db:migrate` against the same database exits 0 again with no errors — idempotent via `drizzle-kit`'s own applied-migrations tracking table (`drizzle.__drizzle_migrations`), not via `IF NOT EXISTS` SQL, since a migration already recorded as applied is simply skipped on a second run (Edge Case: partial/prior schema state).

## Scenario 2 — Standard columns compile and apply correctly (User Story 2)

```bash
pnpm test src/shared/db/columns.test.ts
```

A throwaway table defined using `id()`, `organizationId()`, `timestamps()` from `@/shared/db`, diffed via `drizzle-kit`'s programmatic `generateDrizzleJson`/`generateMigration` API against a Testcontainers Postgres, has the expected column names/types/defaults. A second throwaway table omits `organizationId()` (a genuinely global table) and migrates successfully with no `organization_id` column.

## Scenario 3 — RLS denies unscoped access (User Story 3)

Run the kernel's integration test suite:

```bash
pnpm test src/shared/db/tenant-context.test.ts
```

**Expected assertions** (see `data-model.md`'s throwaway test table):
1. Insert via `withTenantContext(appDb, orgA, ...)` → row lands with `organization_id = orgA`.
2. Query via `withTenantContext(appDb, orgB, ...)` for that same row → empty result (correct-context isolation).
3. Query with **no** `withTenantContext` wrapper at all, using the least-privileged app-role connection → the query throws/is denied by Postgres, not merely empty (this is the acceptance criterion that distinguishes RLS-denial from app-layer filtering).
4. The same assertions repeated using a simulated MCP-tool-handler call path → identical results, proving FR-004's transport-parity requirement.
5. Repeat assertion 3 using the **migration/owner role's** connection instead of the app role → a real, passing assertion that RLS does **not** deny it (rows are returned), demonstrating *why* FR-010's role separation is required, not a case the kernel is expected to guard against.
6. A connection reused from the pool after a `withTenantContext` transaction commits does not retain the prior tenant's setting for a later unrelated query.
7. If `fn` throws inside `withTenantContext`, the transaction rolls back with no partial write.
8. A `withTenantContext` round-trip succeeds using the app role's `prepare: false` client — the PgBouncer-transaction-mode compatibility proof (FR-011).

## Scenario 4 — Audit atomicity (User Story 4)

```bash
pnpm test src/shared/db/with-audit.test.ts
```

**Expected assertions** (`withAudit(db, mutationFn, auditWriteFn)` — both callbacks are required and share one transaction; `auditWriteFn` is a caller-supplied thunk rather than a plain data value withAudit inserts itself, since the real `audit.audit_events` table's shape belongs to Audit & Compliance's own future epic, not this kernel):
1. `withAudit(db, validMutation, validAuditWrite)` → both the mutation's row and the audit-event row are present after commit.
2. `withAudit(db, validMutation, auditWriteThatViolatesAConstraint)` → the mutation's row is **absent** afterward (full rollback, not partial state).
3. `withAudit(db, mutationThatThrows, validAuditWrite)` → the audit-event row is also absent afterward.

## Scenario 5 — Schema creation is idempotent, role-separated, and runnable end-to-end

```bash
pnpm test src/shared/db/schemas.test.ts
```

**Expected**: A fresh Testcontainers Postgres gets all seven schemas from one migration run; re-running the migration against the same instance doesn't error; the dedicated least-privileged app role can `SELECT`/`INSERT` against a table in one of the seven schemas without owning it. Additionally, `pnpm db:migrate` run against a real (non-Testcontainers) local Postgres exits 0 on first and second run alike (validated manually against a throwaway local Postgres container during implementation — see Scenario 1).

## Full local validation

```bash
pnpm db:migrate      # Scenario 1, against a real (non-Testcontainers) local Postgres
pnpm test            # Scenarios 2-5, Testcontainers-backed
pnpm typecheck        # strict-mode TS across the new kernel files
pnpm lint
```

All four MUST pass for this feature to be considered done, per the acceptance criteria in `spec.md`.
