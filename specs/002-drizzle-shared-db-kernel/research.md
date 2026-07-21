# Phase 0 Research: Drizzle Shared DB Kernel

All open questions from the spec's Technical Context were resolved during the `/speckit-clarify` session (see spec.md's Clarifications) or were already decided upstream in `context/database-conventions.md`, `context/testing-strategy.md`, and the accepted PDRs. This document consolidates those decisions into the form Phase 1 design builds on, plus the few implementation-level choices (driver, migration layout) that don't rise to spec-level clarification but still need a stated rationale before design.

## Drizzle Postgres driver

- **Decision**: `postgres` (the `postgres.js` package), via `drizzle-orm/postgres-js`.
- **Rationale**: It's Drizzle's most-documented Postgres driver and — critically for FR-011 — supports disabling prepared statements (`postgres(url, { prepare: false })`), which is required when connecting through a transaction-mode PgBouncer pool (prepared statements aren't safe across pooled transactions that may hop physical connections). `node-postgres` (`pg`) would need the same accommodation manually and has a heavier callback-oriented API for this use case.
- **Alternatives considered**: `pg` (node-postgres) — viable, also supported by Drizzle, but postgres.js's native promise API and built-in pooling are a better fit for a from-scratch kernel with no existing `pg`-specific code to preserve.

## RLS session variable and PgBouncer transaction-mode compatibility

- **Decision**: `withTenantContext` issues `SET LOCAL app.current_org_id = $1` inside the transaction it wraps, never a plain session-level `SET`.
- **Rationale**: `SET LOCAL` is scoped to the current transaction and automatically reset at `COMMIT`/`ROLLBACK` — this is the one form of session state that stays correct when the underlying physical connection is shared across logical sessions by a transaction-mode pooler (FR-011's PgBouncer). A plain `SET` would leak the tenant setting onto whatever the pooler hands the connection to next, which is exactly the edge case the spec calls out ("connections returned to the pool free of any leftover tenant-context session state").
- **Alternatives considered**: Session-level `SET` with an explicit `RESET` in a `finally` block — rejected; still racy under a crash between `SET` and `RESET`, whereas `SET LOCAL` is transaction-atomic by construction and needs no manual cleanup.

## Role separation for RLS enforcement

- **Decision**: Two Postgres roles, both created by the initial migration (or provisioned alongside it): a migration/owner role (creates schemas, owns all tables, runs `drizzle-kit migrate`) and a distinct, least-privileged runtime app role (`GRANT`ed `SELECT/INSERT/UPDATE/DELETE` on the relevant schemas, but not ownership) that the shared client (`client.ts`) connects as. Connection strings for each are read from distinct environment variables (e.g. `MIGRATION_DATABASE_URL` vs `DATABASE_URL`), matching the config-driven-secrets requirement in constitution Principle VI.
- **Rationale**: Postgres row-level security is not enforced against a table's owner (or a superuser) by default — using the same role for migrations and runtime queries would make every RLS policy in this feature inert without any visible error. This is the spec's first clarification.
- **Alternatives considered**: Single role + `FORCE ROW LEVEL SECURITY` — rejected during clarification in favor of true role separation, which is the standard, harder-to-accidentally-regress pattern (a future migration author can't silently weaken enforcement by forgetting a `FORCE` clause on a new table).

## Schema creation migration

- **Decision**: One initial migration (`drizzle/migrations/0000_create_schemas.sql`) that runs `CREATE SCHEMA IF NOT EXISTS` for all seven names, plus the least-privileged app role's `GRANT USAGE`/default-privilege statements. No domain tables are created by this feature.
- **Rationale**: FR-003 and the spec's Assumptions both scope this feature to schema *namespaces* only — each BC epic creates its own tables within its schema later. `IF NOT EXISTS` satisfies the edge case of re-running migrations against a database with partial prior state without erroring.
- **Alternatives considered**: Per-schema migration files (seven files instead of one) — rejected as unnecessary ceremony; there's no per-BC ordering dependency between schema creation statements, so one migration is simpler and matches "one command creates all seven" (SC-001).

## Test strategy

- **Decision**: Vitest integration tests, colocated (`*.test.ts` beside the file under test), each spinning up a real ephemeral Postgres via `testcontainers`/`@testcontainers/postgresql`, then running `drizzle-kit push` (or applying the generated migration directly) before exercising `withTenantContext`/`withAudit`/schema creation against it.
- **Rationale**: `context/testing-strategy.md` has already decided this exact approach project-wide — "RLS specifically cannot be meaningfully unit-tested with a mock... Testcontainers, spinning up a real ephemeral Postgres per test run." This feature is the first to actually need it, so it's also where the `testcontainers` dev dependency first gets added to `package.json`.
- **Alternatives considered**: Reusing the existing `docker-compose.yaml` `postgres` service for tests — rejected; that service still backs the legacy stack (per `CLAUDE.md`, not yet repointed at the new scaffold) and a shared long-lived container doesn't give the per-test isolation the decided Testcontainers approach provides.

## PgBouncer wiring scope

- **Decision**: This feature builds the kernel to be PgBouncer-transaction-mode-*compatible* (`SET LOCAL`-only session state, `prepare: false` on the driver) but does not itself stand up a PgBouncer instance in `docker-compose.yaml` or Terraform. Actually provisioning PgBouncer (or an equivalent managed pooler, e.g. RDS Proxy) in front of each environment's Postgres is an infrastructure/deployment concern that belongs to the AWS hosting work (PDR-009) and the eventual `docker-compose.yaml` repointing (already flagged in `CLAUDE.md` as not yet done for the new scaffold), not to this kernel feature.
- **Rationale**: The spec's own Assumptions section defers "PgBouncer's specific pool mode, queue depth, and timeout values" to planning/deployment; the compatibility requirement (FR-011) is what's testable and owned here, the physical pooler deployment is not.
- **Alternatives considered**: Adding a `pgbouncer` service to `docker-compose.yaml` in this feature — rejected as out of scope; that compose file doesn't yet target the new scaffold at all (still legacy-only per `CLAUDE.md`), so wiring a pooler into it now would be built against the wrong target.
