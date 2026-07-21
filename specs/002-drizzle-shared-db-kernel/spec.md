# Feature Specification: Drizzle Shared DB Kernel

**Feature Branch**: `002-drizzle-shared-db-kernel`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "backlog/001-typescript-refactor-foundation/002-drizzle-shared-db-kernel.md" — Build the shared database plumbing every bounded context will use: the Drizzle client, connection pool, per-BC Postgres schema wiring, the RLS session-variable mechanism, and the `withAudit()` transactional wrapper that guarantees an audit write can never be separated from the mutation it describes (PDR-005). This is infrastructure owned by Distribution per its OWNERSHIP.md (`/shared/db/`), built once here so no bounded-context epic has to invent its own DB access pattern.

## Clarifications

### Session 2026-07-21

- Q: Postgres table owners and superusers bypass row-level security by default regardless of policy definitions. If the app connects using the same role that owns the schemas (the role that also runs migrations), RLS would silently do nothing. How should this be handled? → A: Dedicated least-privilege app role (not the schema owner) is used for all app queries; a separate owner/migration role is used only for `pnpm db:migrate`. RLS applies normally since the app role isn't the owner.
- Q: Concurrent updates to the same row — should the shared column helpers provide optimistic-concurrency conflict detection, or is `updated_at` purely informational with last-write-wins semantics? → A: Last-write-wins. `updated_at` is informational only; no version column; a specific BC table can add its own conflict handling later if it genuinely needs it.
- Q: When the shared connection pool is exhausted under load, what should happen to a new request needing a connection? → A: Route connections through PgBouncer (an external connection-pooling proxy) in front of Postgres, rather than relying solely on the application's own in-process pool sizing; exact queue/timeout tuning is a planning-phase detail governed by PgBouncer's configuration.

## User Scenarios & Testing *(mandatory)*

<!--
  This feature has no end-user-facing UI. Its "users" are the engineers building
  each bounded context (BC) on top of this shared kernel, and — transitively —
  every future BC's tenant data, which depends on this kernel enforcing isolation
  correctly. User stories below are framed from that engineering-consumer perspective.
-->

### User Story 1 - Provision the seven bounded-context schemas (Priority: P1)

As the engineer setting up the database for the first time (or rebuilding it from scratch), I run the project's migration command against a fresh Postgres instance and get all seven bounded contexts' schema namespaces created automatically, with no manual SQL.

**Why this priority**: Nothing else in this feature — or in any later bounded-context epic — can be built or tested until the schemas exist. This is the foundational, blocking capability.

**Independent Test**: Can be fully tested by pointing the migration tooling at an empty Postgres database and confirming all seven named schemas exist afterward, with no other steps required.

**Acceptance Scenarios**:

1. **Given** a completely empty Postgres database, **When** the migration command is run, **Then** all seven bounded-context schemas (`identity_access`, `governance`, `prompt_registry`, `workflow`, `billing`, `audit`, `distribution`) exist and the command exits successfully.
2. **Given** a database that already has these schemas from a prior run, **When** the migration command is run again, **Then** it completes without error and does not duplicate or corrupt existing schema objects.

---

### User Story 2 - Write a tenant-scoped table using shared conventions (Priority: P1)

As an engineer building a new bounded context's schema, I use the shared column helpers (`id`, `organization_id`, `created_at`, `updated_at`) to define my tables instead of hand-rolling column definitions, so my table automatically matches the project-wide tenancy and auditability conventions.

**Why this priority**: Every bounded-context epic that follows this one depends on these primitives existing and being consistent — this is the mechanism by which "no BC invents its own DB access pattern" is actually enforced rather than just asked for.

**Independent Test**: Can be fully tested by defining a throwaway table using the shared column helpers and confirming the resulting table has the correct column names, types, and defaults without writing any bespoke column definitions.

**Acceptance Scenarios**:

1. **Given** a new table definition that uses the shared standard-column helpers, **When** a migration is generated and applied, **Then** the table has `id` (unique, auto-generated), `organization_id`, `created_at`, and `updated_at` with the conventions defined in `context/database-conventions.md`.
2. **Given** a table that is genuinely global and has no per-organization scope, **When** its definition opts out of the `organization_id` helper, **Then** the migration tooling still succeeds and no tenant-isolation mechanism is silently applied to it.

---

### User Story 3 - Enforce tenant isolation at the database layer (Priority: P1)

As an engineer writing a query or mutation against a tenant-scoped table, I establish the current tenant context once (via a shared helper) and the database itself refuses any access to that table that isn't scoped to the established tenant — whether the caller is a REST route handler or an MCP tool handler.

**Why this priority**: This is the RLS backstop required by tenet M2. Without it verified to actually deny (not just filter) unscoped access, every later bounded-context's tenant-isolation claim rests on an unproven mechanism.

**Independent Test**: Can be fully tested by creating a throwaway tenant-scoped test table, inserting a row under one organization's context using the least-privileged application role (not the schema-owning migration role), and confirming (a) reads under the correct context see the row, and (b) reads attempted with no tenant context established are outright denied by the database, not merely returned empty.

**Acceptance Scenarios**:

1. **Given** a throwaway tenant-scoped test table, **When** a row is inserted while the tenant context is established for organization A, **Then** the row is stored with `organization_id` set to organization A.
2. **Given** that same table and row, **When** a query runs with the tenant context established for a different organization, **Then** the row is not visible.
3. **Given** that same table and row, **When** a query runs with no tenant context established at all, **Then** the database denies the query rather than silently returning zero rows.
4. **Given** the same tenant-context mechanism, **When** it is invoked from a simulated MCP tool-handler code path (which does not pass through REST route-handler middleware), **Then** tenant isolation is enforced identically to the REST path.
5. **Given** all queries in this feature's own RLS tests, **When** they run, **Then** they run as the dedicated least-privileged application role rather than the schema-owning migration role, so a passing test is actually proof of enforcement rather than a false positive from ownership bypass.

---

### User Story 4 - Guarantee mutations and their audit record commit or fail together (Priority: P2)

As an engineer performing a mutation that must be audited, I wrap it in the shared audit-guaranteeing helper, so that if the audit write fails for any reason, my mutation is rolled back too — there is no way for the mutation to succeed while its audit trail silently disappears.

**Why this priority**: This is the mechanism that makes tenet C1's audit-coverage guarantee real. It's ranked P2 (not P1) because it depends on the schemas (Story 1) and tenant-context mechanism (Story 3) existing first, but it's still required before any bounded-context epic can claim its mutations are audited.

**Independent Test**: Can be fully tested by wrapping a throwaway mutation and its audit event in the shared helper, then forcing the audit insert to fail (e.g., via a constraint violation) and confirming the mutation's effects are fully rolled back rather than partially committed.

**Acceptance Scenarios**:

1. **Given** a throwaway mutation and a valid paired audit event, **When** both are run through the shared audit-guaranteeing helper, **Then** both the mutation's effect and the audit event are committed together.
2. **Given** the same setup but with the audit event forced to fail a constraint, **When** the helper runs, **Then** the mutation's effect is not committed — the database is left exactly as if neither had been attempted.
3. **Given** a mutation attempted directly against a tenant-scoped table without going through the shared helper, **When** reviewed, **Then** this bypass is identifiable as a violation of the "only sanctioned way to mutate" convention (so later review can flag it), even though the database itself cannot mechanically prevent every possible bypass.

---

### Edge Cases

- What happens when the tenant-context helper's wrapped function throws partway through? The transaction (and the session-scoped tenant setting with it) MUST roll back cleanly, leaving no partial writes and no leaked tenant context on the underlying pooled connection.
- What happens when a connection is returned to the pool after a transaction that set the tenant-context session variable? The next borrower of that connection MUST NOT inherit the previous tenant's context.
- What happens when a table opts out of the standard `organization_id` column (a genuinely global table)? The shared helpers MUST support this without forcing a tenant-isolation policy onto a table that has no tenant concept.
- What happens when the migration command is run against a database where only some of the seven schemas already exist (partial prior state)? It MUST still converge to all seven schemas existing, without erroring on the ones already present.
- What happens when the audit-guaranteeing helper is called with a mutation function that itself throws (independent of the audit insert)? The audit event MUST also not be committed — failure on either side rolls back both.
- What happens if the application accidentally connects using the schema-owning migration role instead of the dedicated least-privileged application role? Row-level-security policies would be silently bypassed by Postgres's ownership rules, so the two roles MUST be distinct and the application MUST never be configured to run as the owning role.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a shared Drizzle ORM client and connection pool that every bounded context imports rather than each constructing its own.
- **FR-002**: The system MUST provide migration tooling wired to project-level commands (`pnpm db:migrate` to apply, `pnpm db:generate` to generate migrations from schema changes) so schema changes follow one consistent workflow across all bounded contexts.
- **FR-003**: The system MUST create all seven bounded-context Postgres schemas (`identity_access`, `governance`, `prompt_registry`, `workflow`, `billing`, `audit`, `distribution`) via migration, matching the schema ownership declared in each bounded context's `OWNERSHIP.md`.
- **FR-004**: The system MUST provide a tenant-context helper that establishes the current organization for a unit of work (a transaction) such that every tenant-scoped query and write within it is subject to row-level-security enforcement for that organization, and this helper MUST be usable identically from both REST route handlers and MCP tool handlers.
- **FR-005**: The system MUST enforce, via Postgres row-level security, that any access to a tenant-scoped table without an established tenant context is denied outright — not merely filtered to zero rows.
- **FR-006**: The system MUST provide an audit-guaranteeing mutation wrapper that runs a mutation and its corresponding audit-event write in the same transaction, such that either both commit or neither does.
- **FR-007**: The system MUST provide reusable standard-column definitions (`id`, `organization_id`, `created_at`, `updated_at`) that bounded-context schema files use directly rather than redefining per table, with support for tables that are genuinely global and omit `organization_id`. `updated_at` is informational only (last-write-wins on concurrent updates); the kernel does not provide optimistic-concurrency conflict detection.
- **FR-008**: The system MUST leave connections returned to the pool free of any leftover tenant-context session state from a prior transaction.
- **FR-009**: The system MUST NOT delete rows from the `audit` schema's event table through any application code path (deletion there is out of scope for this feature, reserved for a future retention job).
- **FR-010**: The system MUST connect to Postgres at runtime using a dedicated, least-privileged application role that is distinct from the role used to run migrations (which owns the schemas/tables) — since Postgres row-level security does not apply to a table's owning role by default, using the owning role at runtime would silently defeat FR-005.
- **FR-011**: The system MUST route application database connections through an external connection-pooling proxy (PgBouncer) sitting in front of Postgres, rather than relying solely on a large per-application-instance connection pool, so connection count scales independently of application instance count.
- **FR-012**: The system MUST fail loudly at startup — not silently connect — if the runtime or migration database connection string is missing or still equal to its documented placeholder value, per constitution Principle VI's ban on security-critical settings shipping with a functional default in production.

### Key Entities

- **Bounded-context schema namespace**: One of the seven Postgres schemas (`identity_access`, `governance`, `prompt_registry`, `workflow`, `billing`, `audit`, `distribution`) that scopes a bounded context's tables. Owned per `bcs/*/OWNERSHIP.md`; this feature creates the namespaces but not the domain tables inside them.
- **Tenant context**: The organization identifier established for the duration of a transaction, used by row-level-security policies to decide what a query may see or write.
- **Audit event record**: A row describing a mutation (what happened, to what, by whom) that must be committed atomically with the mutation it describes. This feature guarantees the atomicity mechanism; the event's own shape is owned by Audit & Compliance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can provision a complete, correctly-schemed database from empty in a single command, with zero manual SQL steps.
- **SC-002**: 100% of attempts to read or write a tenant-scoped table without an established tenant context are rejected by the database itself, verified across both simulated REST and simulated MCP call paths.
- **SC-003**: 100% of mutations run through the shared audit-guaranteeing wrapper either commit with their audit record present, or roll back entirely — zero partial-state outcomes are observed under forced-failure testing.
- **SC-004**: A developer building a brand-new bounded context can define a fully conventions-compliant, tenant-isolated, auditable table without writing any custom connection, pooling, RLS, or audit-atomicity code of their own.

## Assumptions

- The tenant-context mechanism is transaction-scoped (established per unit of work via a helper function) rather than solely set by REST route-handler middleware — this generalizes correctly to MCP tool handlers, which don't share that middleware layer, resolving the open question raised in the source backlog item.
- Standard columns and hard-delete-by-default follow `context/database-conventions.md`; the one exception (`audit.audit_events` is never deleted by application code) is treated as authoritative and out of scope to revisit here.
- The seven schema names and their bounded-context ownership are fixed inputs from each BC's `OWNERSHIP.md` and are not themselves under negotiation in this feature.
- This feature builds only the shared kernel (client, pooling, schema creation, tenant-context helper, audit wrapper, column helpers) and throwaway test tables to prove the mechanisms — it does not build any bounded context's actual domain tables; those are each BC epic's own responsibility.
- "Denied by RLS" is verified using a throwaway test table and test schema created and torn down as part of this feature's own testing, not a permanent fixture, and is run as the dedicated least-privileged application role (see Clarifications) so the result is a valid proof rather than a false positive from owner/superuser RLS bypass.
- PgBouncer's specific pool mode, queue depth, and timeout values are a planning-phase tuning detail; this spec only fixes that an external pooling proxy sits in front of Postgres rather than relying on in-process pool sizing alone.
