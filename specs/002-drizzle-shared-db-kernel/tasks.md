---

description: "Task list for Drizzle Shared DB Kernel"
---

# Tasks: Drizzle Shared DB Kernel

**Input**: Design documents from `/specs/002-drizzle-shared-db-kernel/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/shared-db-kernel.md, quickstart.md

**Tests**: Included and REQUIRED — constitution Principle I (Test-First) and `context/testing-strategy.md` mandate a failing Testcontainers-backed integration test before each kernel primitive is implemented. Do not skip the "write first, confirm it fails" step.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to spec.md's User Story 1-4
- File paths are exact and relative to repo root

## Path Conventions

Single Next.js project per `plan.md`'s Structure Decision — all new code under `src/shared/db/`, plus root-level `drizzle.config.ts` and `drizzle/migrations/`. No separate `tests/` tree; tests are colocated `*.test.ts` files.

---

## Phase 1: Setup

**Purpose**: Add the dependencies and scripts every later phase needs.

- [X] T001 Add `drizzle-orm`, `postgres` (runtime deps) and `drizzle-kit`, `testcontainers`, `@testcontainers/postgresql` (dev deps) to `package.json`; run `pnpm install`
- [X] T002 [P] Add `"db:migrate": "drizzle-kit migrate"` and `"db:generate": "drizzle-kit generate"` scripts to `package.json`
- [X] T003 [P] Create `.env.example` at repo root documenting `MIGRATION_DATABASE_URL` (owner/migration role) and `DATABASE_URL` (least-privileged runtime app role) with placeholder values, per research.md's role-separation decision

**Checkpoint**: `pnpm install` succeeds; `pnpm db:migrate`/`pnpm db:generate` exist as commands (will fail until Phase 2 config exists — expected).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure every user story's tests and implementation depend on — schema-name constants, the drizzle-kit config, the pooled client for both DB roles, and the shared Testcontainers test harness.

**⚠️ CRITICAL**: No user story phase can begin until this phase is complete.

- [X] T004 [P] Define the seven schema-name constants (`SCHEMAS`) in `src/shared/db/schemas.ts` per data-model.md's table
- [X] T005 [P] Implement `src/shared/db/client.ts`: export `db` (Drizzle instance over `postgres.js`, connected via `DATABASE_URL`, `prepare: false` for PgBouncer-transaction-mode compatibility per research.md), plus an internal (non-barrel-exported) `createRoleClient(url)` factory used by tests and `drizzle.config.ts` to open a second connection as the migration/owner role
- [X] T006 Create `drizzle.config.ts` at repo root: schema file glob, `out: "./drizzle/migrations"`, dialect `postgresql`, connection via `MIGRATION_DATABASE_URL` (depends on T004)
- [X] T007 Implement shared Testcontainers test harness in `src/shared/db/test-helpers.ts`: starts an ephemeral Postgres container per test run, runs the current migrations against it via `createRoleClient` (owner role) and exposes both an owner-role and an app-role Drizzle client for use in test files, plus a teardown function (depends on T005, T006)
- [X] T008 Update `src/shared/db/index.ts` barrel to export only `db` and `SCHEMAS` at this point (column/tenant-context/audit exports added in later phases) — confirms no internal file (`client.ts`'s `createRoleClient`, `test-helpers.ts`) leaks through the barrel, per contracts/shared-db-kernel.md
- [X] T038 [P] Unit test in `src/shared/db/client.test.ts` (write first, confirm FAIL): constructing `createRoleClient`/`db` with a missing env var or with the exact placeholder value documented in `.env.example` throws synchronously at startup rather than attempting a connection (FR-012, closes a constitution Principle VI gap found in `/speckit-analyze`)
- [X] T039 Implement the fail-loud placeholder/missing-connection-string check in `src/shared/db/client.ts` and `drizzle.config.ts`, satisfying T038 (depends on T005, T006, T038)

**Checkpoint**: `src/shared/db/test-helpers.ts` can start a Testcontainers Postgres and connect as both roles (verify with a throwaway smoke script or the first US1 test in Phase 3). `client.ts` refuses to start on a placeholder/missing connection string (T038-T039). Foundation ready — user story work can begin.

---

## Phase 3: User Story 1 - Provision the seven bounded-context schemas (Priority: P1) 🎯 MVP

**Goal**: `pnpm db:migrate` against a fresh Postgres creates all seven bounded-context schemas and provisions the two DB roles, idempotently.

**Independent Test**: Point migration tooling at an empty Postgres database (via the Testcontainers harness in tests, and manually via a real local Postgres for the `pnpm db:migrate` command itself) and confirm all seven schemas exist, command exits 0, and re-running is a no-op success.

### Tests for User Story 1 ⚠️ (write first, confirm FAIL before implementation)

- [X] T009 [P] [US1] Integration test in `src/shared/db/schemas.test.ts`: fresh Testcontainers Postgres + running the migration creates all seven schemas listed in `SCHEMAS` (assert via `information_schema.schemata`)
- [X] T010 [P] [US1] Integration test in `src/shared/db/schemas.test.ts`: running the migration twice against the same container does not error (idempotent via `drizzle-kit`'s own applied-migrations tracking table, which skips an already-applied migration on re-run)
- [X] T011 [P] [US1] Integration test in `src/shared/db/schemas.test.ts`: the runtime app role (from `DATABASE_URL`/`createRoleClient`) can `SELECT`/`INSERT` against a throwaway table created in one of the seven schemas, while owning none of the schemas itself (proves the role/grant setup, not just schema existence)

### Implementation for User Story 1

- [X] T012 [US1] Generate `drizzle/migrations/0000_create_schemas.sql` via `drizzle-kit generate` from the `pgSchema()` exports in `schemas.ts`, then hand-append the idempotent `skillcanon_app` role-creation `DO` block, `GRANT USAGE`, and `ALTER DEFAULT PRIVILEGES` statements (or reference pre-provisioned roles — see task note on environment-specific role provisioning) (depends on T004, T006, T009-T011 failing correctly first)
- [X] T013 [US1] Wire `pnpm db:migrate` end-to-end against a real local Postgres (`database/` docker image or equivalent) and confirm exit code 0 per quickstart.md Scenario 1

**Checkpoint**: User Story 1 fully functional and testable independently — `pnpm test src/shared/db/schemas.test.ts` and `pnpm db:migrate` both pass.

---

## Phase 4: User Story 2 - Write a tenant-scoped table using shared conventions (Priority: P1)

**Goal**: Bounded-context schema files can use shared standard-column builders (`id`, `organizationId`, `timestamps`) instead of hand-rolled column definitions, with support for genuinely global tables that opt out of `organizationId`.

**Independent Test**: Define a throwaway table using the column helpers, migrate it via the Testcontainers harness, and confirm column names/types/defaults match `context/database-conventions.md`.

### Tests for User Story 2 ⚠️ (write first, confirm FAIL before implementation)

- [X] T014 [P] [US2] Integration test in `src/shared/db/columns.test.ts`: a throwaway table defined with `id()`, `organizationId()`, `timestamps()` gets a UUID primary key with `gen_random_uuid()` default, a non-null `organization_id`, and `created_at`/`updated_at` timestamptz columns with `now()` defaults
- [X] T015 [P] [US2] Integration test in `src/shared/db/columns.test.ts`: a throwaway table that omits `organizationId()` (a genuinely global table) migrates successfully and has no `organization_id` column, no RLS policy applied

### Implementation for User Story 2

- [X] T016 [US2] Implement `id()`, `organizationId()`, `timestamps()` builders in `src/shared/db/columns.ts` per data-model.md's Standard Columns table (depends on T004)
- [X] T017 [US2] Add `id`, `organizationId`, `timestamps` to the `src/shared/db/index.ts` barrel export (depends on T008, T016)

**Checkpoint**: User Stories 1 AND 2 both work independently — `pnpm test src/shared/db/columns.test.ts` passes alongside Phase 3's tests.

---

## Phase 5: User Story 3 - Enforce tenant isolation at the database layer (Priority: P1)

**Goal**: `withTenantContext(db, organizationId, fn)` establishes the RLS session variable transaction-scoped, identically from REST and MCP call paths; unscoped access is denied outright by Postgres, not merely filtered.

**Independent Test**: Insert a row via `withTenantContext(appDb, orgA, ...)`, confirm it's invisible under `orgB`'s context and denied outright with no context established at all — using the least-privileged app role, per this story's clarification.

### Tests for User Story 3 ⚠️ (write first, confirm FAIL before implementation)

- [X] T018 [P] [US3] Integration test in `src/shared/db/tenant-context.test.ts`: create a throwaway RLS-enabled tenant-scoped test table (migration/fixture), insert via `withTenantContext(orgA, ...)`, and confirm the row's `organization_id` is `orgA`
- [X] T019 [US3] Integration test in `src/shared/db/tenant-context.test.ts`: querying that row via `withTenantContext(orgB, ...)` returns no rows (depends on T018's fixture)
- [X] T020 [US3] Integration test in `src/shared/db/tenant-context.test.ts`: querying that row with no `withTenantContext` wrapper at all, using the app-role client, throws/is denied rather than returning zero rows silently (depends on T018)
- [X] T021 [P] [US3] Integration test in `src/shared/db/tenant-context.test.ts`: repeating T018-T020's assertions via a simulated MCP-tool-handler call path produces identical results, proving FR-004's transport parity
- [X] T022 [P] [US3] Integration test in `src/shared/db/tenant-context.test.ts`: the same no-context query in T020, run using the migration/owner role's client instead of the app role, is **not** denied — documented via an inline comment as the exact bypass FR-010's role separation exists to prevent (not a case the kernel is expected to block)
- [X] T023 [P] [US3] Integration test in `src/shared/db/tenant-context.test.ts`: a connection reused from the pool after a `withTenantContext` transaction commits/rolls back does not retain the prior tenant's `app.current_org_id` setting for a subsequent unrelated query
- [X] T024 [P] [US3] Integration test in `src/shared/db/tenant-context.test.ts`: if `fn` throws inside `withTenantContext`, the transaction rolls back and no partial write lands
- [X] T040 [P] [US3] Integration test in `src/shared/db/tenant-context.test.ts`: a `withTenantContext(orgA, ...)` round-trip (insert + read-back) succeeds identically using the `prepare: false` client from `client.ts`, proving FR-011's PgBouncer-transaction-mode compatibility claim (per quickstart.md Scenario 5 — added during `/speckit-analyze` remediation, was previously described in quickstart.md but not mapped to a task)

### Implementation for User Story 3

- [X] T025 [US3] Add the throwaway RLS-enabled test table + `ENABLE ROW LEVEL SECURITY` + tenant-isolation policy to the test fixture/migration used by T018 (`src/shared/db/test-helpers.ts` or a dedicated fixture migration), following the exact policy shape in `context/database-conventions.md`
- [X] T026 [US3] Implement `withTenantContext(db, organizationId, fn)` in `src/shared/db/tenant-context.ts`: opens a transaction on the passed-in `db`, issues `select set_config('app.current_org_id', $1, true)` (the parameterizable equivalent of `SET LOCAL` — Postgres's `SET` doesn't accept bind params), runs `fn(tx)`, returns its result. Takes `db` as an explicit parameter (not the shared singleton) so the same helper works against a Testcontainers instance in tests (depends on T005)
- [X] T027 [US3] Add `withTenantContext` to the `src/shared/db/index.ts` barrel export (depends on T008, T026)

**Checkpoint**: User Stories 1-3 all work independently — `pnpm test src/shared/db/tenant-context.test.ts` passes.

---

## Phase 6: User Story 4 - Guarantee mutations and their audit record commit or fail together (Priority: P2)

**Goal**: `withAudit(db, mutationFn, auditWriteFn)` runs a mutation and its audit-event insert in one transaction; either both commit or neither does.

**Independent Test**: Force the throwaway audit-event insert to violate a constraint and confirm the paired mutation's effect is fully rolled back, not partially committed.

### Tests for User Story 4 ⚠️ (write first, confirm FAIL before implementation)

- [X] T028 [P] [US4] Integration test in `src/shared/db/with-audit.test.ts`: `withAudit(db, validMutation, validAuditWrite)` commits both the mutation's row and the throwaway audit-event row
- [X] T029 [US4] Integration test in `src/shared/db/with-audit.test.ts`: `withAudit(db, validMutation, auditWriteViolatingAConstraint)` leaves the mutation's row absent afterward (full rollback) (depends on T028's fixture)
- [X] T030 [US4] Integration test in `src/shared/db/with-audit.test.ts`: `withAudit(db, mutationThatThrows, validAuditWrite)` leaves the audit-event row absent afterward (depends on T028's fixture)

### Implementation for User Story 4

- [X] T031 [US4] Add the throwaway audit-event test table (per data-model.md's conceptual shape: `id`, `organization_id`, `event_type` with a `CHECK`/`NOT NULL` constraint, `created_at`) to the test fixture used by T028
- [X] T032 [US4] Implement `withAudit(db, mutationFn, auditWriteFn)` in `src/shared/db/with-audit.ts`: opens one transaction, runs `mutationFn(tx)` then `auditWriteFn(tx)` within the same transaction, so either both commit or the transaction rolls back (depends on T005; `auditWriteFn` is a required parameter, not optional — and a caller-supplied thunk rather than a plain data value, since the real `audit.audit_events` table's shape belongs to Audit & Compliance's own future epic — per contracts/shared-db-kernel.md's stability guarantee)
- [X] T033 [US4] Add `withAudit` to the `src/shared/db/index.ts` barrel export (depends on T008, T032)
- [X] T041 [US4] Add a code comment on `with-audit.ts` (or `index.ts`) stating explicitly that no delete helper is exported for the `audit` schema and none should be added outside a future retention job, satisfying FR-009 — closes a coverage gap with zero prior task found during `/speckit-analyze` (FR-009 was previously satisfied only by omission, with nothing guarding against a future regression)

**Checkpoint**: All four user stories independently functional — `pnpm test src/shared/db/with-audit.test.ts` passes alongside every earlier phase's tests.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [X] T034 [P] Run `pnpm typecheck` and fix any strict-mode errors across `src/shared/db/**`
- [X] T035 [P] Run `pnpm lint` and fix any findings across `src/shared/db/**`
- [X] T036 Run the full `pnpm test` suite and confirm every `src/shared/db/*.test.ts` file passes together (not just individually — checks for cross-test container/state leakage)
- [X] T037 Walk through every scenario in `quickstart.md` end-to-end and confirm expected outcomes match

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories. Includes T038-T039 (fail-loud placeholder-connection-string check, FR-012).
- **User Story 1 (Phase 3)**: Depends on Phase 2 only
- **User Story 2 (Phase 4)**: Depends on Phase 2 only (independent of US1's migration content — only needs `SCHEMAS`/`client.ts`)
- **User Story 3 (Phase 5)**: Depends on Phase 2 only (independent of US1/US2 — needs its own RLS test fixture)
- **User Story 4 (Phase 6)**: Depends on Phase 2 only (independent of US1/US2/US3 — needs its own audit-event test fixture)
- **Polish (Phase 7)**: Depends on all four user stories being complete

### User Story Dependencies

All four user stories depend only on the Foundational phase, not on each other — each defines and tears down its own throwaway test fixtures, so they can be implemented in any order or in parallel by different contributors. Priority order (P1, P1, P1, P2 per spec.md) reflects value/build-blocking order for later BC epics, not a technical dependency: US1 (schemas existing) is the practical prerequisite every later BC epic needs first, so it's the recommended MVP cut even though US2/US3 aren't technically blocked on it.

### Within Each User Story

- Tests MUST be written and confirmed failing before implementation (constitution Principle I)
- Test fixtures (throwaway tables/roles) before the primitive under test
- Barrel export update (`index.ts`) last, once the primitive is implemented and tested

### Parallel Opportunities

- T002, T003 in Setup can run in parallel
- T004, T005 in Foundational can run in parallel (different files)
- All test tasks marked [P] within a story can run in parallel (they share a Testcontainers fixture pattern but are independent assertions once the fixture-creation task lands)
- Once Phase 2 completes, Phases 3-6 (all four user stories) can be worked on in parallel by different contributors

---

## Parallel Example: User Story 3

```bash
# Tests can be written in parallel (all target the same fixture, added in T025, but assert independent behavior):
Task: "Integration test: insert via withTenantContext(orgA) lands with orgA's organization_id"
Task: "Integration test: MCP-path parity for tenant isolation"
Task: "Integration test: owner-role bypass is NOT denied (documents why role separation matters)"
Task: "Integration test: pooled connection reuse doesn't leak tenant context"
Task: "Integration test: thrown error inside withTenantContext rolls back cleanly"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 — schemas provisioned, `pnpm db:migrate` works end-to-end
4. **STOP and VALIDATE**: `pnpm test src/shared/db/schemas.test.ts` and a manual `pnpm db:migrate` run both pass
5. This unblocks every later BC epic's own schema file, even before US2-4 land

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. User Story 1 → schemas exist → BC epics can start defining tables (still hand-rolling columns/RLS for now)
3. User Story 2 → BC epics adopt shared column helpers
4. User Story 3 → BC epics get the RLS backstop mechanism (tenet M2 satisfied at the kernel level)
5. User Story 4 → BC epics get the audit-atomicity guarantee (tenet C1 satisfied at the kernel level)
6. Polish → typecheck/lint/full-suite/quickstart pass together

### Parallel Team Strategy

With multiple contributors, once Phase 2 is done: one person on US1 (migration/schemas), one on US2 (columns), one on US3 (tenant context — the most test-heavy story), one on US4 (audit wrapper) — all four touch disjoint files (`schemas.ts`/migration, `columns.ts`, `tenant-context.ts`, `with-audit.ts`) and only converge at the shared `index.ts` barrel, which is a small, low-conflict final edit per story.

---

## Notes

- [P] tasks = different files or independent assertions, no dependencies
- [Story] label maps task to specific user story for traceability
- Every user story is independently completable and testable via its own throwaway fixture — no story depends on another's fixture existing
- Verify each test fails for the right reason before implementing (constitution Principle I / red-green-iterate)
- Commit after each task or logical group
- Environment-specific provisioning of the actual Postgres roles referenced by `MIGRATION_DATABASE_URL`/`DATABASE_URL` (e.g., via Terraform in AWS, or a local dev bootstrap script) is noted at T012 but the concrete provisioning mechanism for each deployment target is out of this feature's scope per research.md's PgBouncer-wiring-scope precedent — this feature's migration creates/grants the roles when it has permission to (fresh local/Testcontainers Postgres); a managed environment where roles are provisioned out-of-band via IaC only needs the `GRANT`/schema-creation statements to run idempotently against pre-existing roles.
- T038-T041 were added during the `/speckit-analyze` pass (not the original `/speckit-tasks` generation) to close gaps found there: T038-T039 close a CRITICAL constitution-alignment gap (FR-012, fail loudly on a placeholder/missing DB connection string), T040 closes a quickstart.md/tasks.md inconsistency (FR-011's PgBouncer round-trip proof), and T041 closes a coverage gap (FR-009 had zero mapped tasks). Total task count is now 41 (T001-T041).
