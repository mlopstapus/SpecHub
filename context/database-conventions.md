# Database Schema & Tenancy Conventions

**Status:** Decided
**Decided:** 2026-07-21
**Backlog item:** `backlog/000-foundations/002-database-schema-and-tenancy-conventions.md`

## Standard columns

Every table gets, unless explicitly global (e.g. `billing.plans`):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (default `gen_random_uuid()`) | Primary key, never reused (matches Identity & Access's stability guarantee) |
| `organization_id` | `uuid` | Not null except genuinely global tables. FK to `identity_access.organizations.id` (see Cross-schema FKs below) |
| `created_at` | `timestamptz` (default `now()`) | |
| `updated_at` | `timestamptz` (default `now()`, updated via trigger or app-layer `onUpdate`) | |

Naming: `snake_case` columns/tables (Postgres convention), Drizzle schema files map them to `camelCase` in TS.

## Tenant isolation: RLS pattern

**Session-variable-based RLS.** Each request's transaction sets a session variable, and every tenant-scoped table has a policy predicate reading it:

```sql
-- once per tenant-scoped table
ALTER TABLE governance.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON governance.policies
  USING (organization_id = current_setting('app.current_org_id')::uuid);
```

```ts
// app layer, start of every request's transaction
await db.execute(sql`select set_config('app.current_org_id', ${orgId}, true)`);
```

Use `set_config(name, value, is_local)` rather than a literal `SET LOCAL name = value` statement — Postgres's `SET` command does not accept bind parameters, so `SET LOCAL app.current_org_id = ${orgId}` either fails or forces unsafe string interpolation. `set_config(..., true)` is the parameterizable equivalent (`is_local = true` matches `SET LOCAL`'s transaction-scoped, auto-reset-on-commit/rollback behavior) and is what `shared/db/tenant-context.ts`'s `withTenantContext()` actually implements — see epic `001-typescript-refactor-foundation`'s `002-drizzle-shared-db-kernel`.

Chosen over a role-per-tenant model (too much connection-pool/role-management overhead for Drizzle's pooled connections) or JWT-claim-reading policy functions (couples RLS to the auth layer instead of the request's resolved tenant context). This is a **backstop** per tenet M2 — the app layer's explicit `organization_id` filtering (tenet M1) remains the primary control and what tests target directly.

## Soft-delete vs. hard-delete

**Hard-delete everywhere**, with one exception: `audit.audit_events` is never deleted by application code at all — only by the entitlement-driven retention job (`auditRetentionDays`, see `context/entitlements.md`). No other domain in this system has a compliance requirement that survives a row's deletion; Audit & Compliance already captures the before-state of any mutation, so soft-delete's `WHERE deleted_at IS NULL` tax on every query isn't justified elsewhere.

## Migration workflow

- `drizzle-kit` generates migrations from schema changes; migrations are named `<timestamp>_<bc-name>_<short-description>` (e.g. `20260722_governance_add_policy_priority`) so the owning BC is visible in the migration file list without opening it.
- A migration touching `bcs/<name>/schema.ts` is reviewed as part of the same PR as the schema change — no standalone migration PRs.
- Migrations run automatically on deploy (via the CI/CD pipeline — see `context/deployment.md`), before the new app version receives traffic.

## Cross-schema foreign keys

**Allowed, but only for referencing Identity & Access's tenant-root IDs** (`identity_access.organizations.id`, and `identity_access.teams.id`/`users.id` where a table genuinely needs a direct FK to them). Identity & Access is already the designated "shared-identifier source for everyone" per `architecture.md` — a real FK to `organizations.id` gives Postgres-enforced referential integrity for the one ID that truly is universal, and costs nothing in coupling since Identity & Access's ID stability is already a contract guarantee.

Cross-schema FKs are **not** used between any other pair of schemas (e.g. `billing.subscriptions` does not FK into `governance.policies`) — those relationships go through application-level contract calls only, keeping non-Identity schemas decoupled from each other as the bounded-context map requires.

## Deliverable status

This document is the reference every BC epic's model/CRUD features point back to. Supersedes ad hoc per-BC decisions on these points.
