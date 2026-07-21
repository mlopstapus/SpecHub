# Phase 1 Data Model: Drizzle Shared DB Kernel

This feature creates Postgres schema *namespaces* and reusable column/behavior primitives — it does not create any bounded context's domain tables (those are each BC epic's own responsibility, per spec Assumptions). The entities below are the concepts this kernel's own code and tests operate on.

## Bounded-context schema namespace

A Postgres schema scoping one bounded context's tables. Fixed set, created once by this feature's migration:

| Schema | Owning BC (per `OWNERSHIP.md`) |
|---|---|
| `identity_access` | Identity & Access |
| `governance` | Governance |
| `prompt_registry` | Prompt Registry |
| `workflow` | Workflow Orchestration |
| `billing` | Billing & Entitlements |
| `audit` | Audit & Compliance |
| `distribution` | Distribution |

No attributes beyond the name itself — this feature's migration issues `CREATE SCHEMA IF NOT EXISTS <name>` for each and grants the runtime app role usage/default privileges on it. Table-level structure inside each schema is out of scope here.

## Standard columns

Reusable Drizzle column-builder helpers, applied by any BC's schema file when defining a table (FR-007):

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | Primary key, never reused |
| `organization_id` | `uuid` | — (required) | FK to `identity_access.organizations.id`; omitted entirely for genuinely global tables (e.g. `billing.plans`) — not nullable, not defaulted, simply not present |
| `created_at` | `timestamptz` | `now()` | |
| `updated_at` | `timestamptz` | `now()`, refreshed on update | Informational only — last-write-wins on concurrent updates; no optimistic-concurrency/version column (per Clarifications) |

Naming: `snake_case` in Postgres, mapped to `camelCase` in the Drizzle TS schema, per `context/database-conventions.md`.

## Tenant context

Not a persisted entity — the organization identifier established for the lifetime of one transaction via `withTenantContext(organizationId, fn)`.

- **Established by**: `SET LOCAL app.current_org_id = <organizationId>` at the start of the wrapped transaction.
- **Read by**: every tenant-scoped table's RLS policy predicate (`organization_id = current_setting('app.current_org_id')::uuid`).
- **Lifecycle**: scoped strictly to the transaction; never leaks to the next transaction on a pooled connection (validated by the connection-reuse edge case test).
- **Callable from**: both REST route handlers and MCP tool handlers identically (FR-004) — there is no middleware-only path.

## Database roles

Not application data, but a fixed operational concept this feature's migration provisions and its tests depend on:

| Role | Used by | Privileges |
|---|---|---|
| Migration/owner role | `pnpm db:migrate` / `drizzle-kit` only | Owns all seven schemas and their tables; RLS does not apply to this role (Postgres default) |
| Runtime app role | The shared client (`client.ts`), all BC application code | `SELECT`/`INSERT`/`UPDATE`/`DELETE` on tenant-scoped tables, subject to RLS; never schema-owning |

## Audit event record (conceptual, for this feature's own test only)

The real `audit.audit_events` table's shape is owned by Audit & Compliance and built in its own future epic. This feature's `withAudit()` proof uses a throwaway audit-event-shaped table in a test schema, with just enough structure to demonstrate the atomicity guarantee:

| Field | Type | Purpose in the throwaway test |
|---|---|---|
| `id` | `uuid` | Primary key |
| `organization_id` | `uuid` | Tenant scope, same convention as any table |
| `event_type` | `text` (constrained, e.g. `CHECK` or `NOT NULL`) | Forced-failure lever — the test violates this constraint to prove the paired mutation rolls back |
| `created_at` | `timestamptz` | Standard column |

## Relationships

- Every tenant-scoped table (in any BC schema) → `organizations.id` (Identity & Access) via `organization_id`, the one cross-schema FK this project allows (`context/database-conventions.md`).
- No relationships are created between the seven schema namespaces themselves by this feature — they are siblings, not a hierarchy.
