# Implementation Plan: Drizzle Shared DB Kernel

**Branch**: `002-drizzle-shared-db-kernel` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-drizzle-shared-db-kernel/spec.md`

## Summary

Build the shared Drizzle/Postgres kernel (`src/shared/db/`) that every bounded context imports instead of inventing its own DB access: a pooled client connecting through a dedicated least-privileged app role (never the schema-owning migration role, so RLS actually applies), `drizzle-kit`-driven migrations that create the seven per-BC Postgres schemas, a transaction-scoped `withTenantContext(organizationId, fn)` helper that sets the RLS session variable identically for REST and MCP callers, a `withAudit(mutationFn, auditEvent)` wrapper guaranteeing a mutation and its audit event commit or roll back together, and reusable standard-column builders (`id`, `organization_id`, `created_at`, `updated_at`).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode), Node.js ≥24

**Primary Dependencies**: `drizzle-orm` + `drizzle-kit` (PDR-002), `postgres` (postgres.js driver — see research.md), `testcontainers` + `@testcontainers/postgresql` (dev dependency, test-only)

**Storage**: PostgreSQL 16 (`database/Dockerfile`), seven schemas: `identity_access`, `governance`, `prompt_registry`, `workflow`, `billing`, `audit`, `distribution`

**Testing**: Vitest, integration tier per `context/testing-strategy.md` — Testcontainers spins up a real ephemeral Postgres per test run (RLS cannot be meaningfully unit-tested with a mock)

**Target Platform**: Linux containers — Docker Compose (local self-host), Helm/K8s (self-host at scale), AWS ECS/Fargate behind RDS (managed SaaS, per PDR-009)

**Project Type**: Single Next.js/TypeScript application — this feature is shared infrastructure (`/shared/db/`) inside it, not a standalone service

**Performance Goals**: No numeric target is set for this feature — connection scaling is delegated to PgBouncer (FR-011) rather than in-process pool tuning, so this feature's own performance surface is limited to correctness (migrations complete, transactions commit/roll back), not throughput.

**Constraints**: `withTenantContext` MUST use `SET LOCAL` (transaction-scoped, not session-scoped) so it stays correct under PgBouncer's transaction-pooling mode; the runtime app role MUST be distinct from the migration/owner role (FR-010); helper functions MUST be callable identically from REST route handlers and MCP tool handlers (FR-004); connection strings MUST NOT be silently used at their placeholder value (FR-012, per constitution Principle VI)

**Scale/Scope**: One shared module tree (`src/shared/db/`) plus one `drizzle.config.ts` and one initial migration creating the seven schema namespaces — no bounded-context domain tables are created by this feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | How this feature satisfies it |
|---|---|---|
| I. Test-First (P1) | Yes | Every kernel primitive (`withTenantContext`, `withAudit`, schema migration) gets a failing Testcontainers-backed integration test before implementation, per `context/testing-strategy.md`'s red-green-iterate cycle. TypeScript's own strict-mode type checker is an additional signal this project has that legacy Python didn't, but it does not substitute for the required test. |
| II. Domain-Driven Bounded Contexts (D1) | Partially — this is the explicit `/shared/` carve-out | This feature is cross-cutting infrastructure, not a bounded context itself; it is owned by Distribution per its `OWNERSHIP.md` precisely because `/shared/db/` sits outside the BC-contract boundary rule by design. No BC's ORM models are imported here — only Postgres-level primitives (client, pool, schema names). |
| III. Domain Invariants in Domain Layer (D2) | N/A | This feature has no business-domain invariants of its own (no "policy's tenant derives from its team" style rule) — it is transport- and domain-agnostic plumbing. |
| IV. Multi-Tenant Isolation by Default (M1, M2, M3) | Yes — this is the feature's core purpose | Builds the RLS backstop (M2) via `withTenantContext` + policies, generalized identically to REST and MCP. App-layer scoping (M1) and the per-resource-type negative test (M3) remain each BC epic's own responsibility per this spec's Assumptions — this feature proves the *mechanism* denies unscoped access, not that any particular BC table uses it correctly. |
| V. Secure by Default (S1-S3) | Yes | The dedicated least-privileged runtime DB role (this feature's first clarification) is a direct instance of "secure by default" — the app can never accidentally run with schema-owner privileges that silently bypass RLS. No secrets are hardcoded; role credentials come from environment configuration, and FR-012 (added during `/speckit-analyze`) requires startup to fail loudly rather than silently connect if a connection-string env var is missing or still at its documented placeholder value — the same discipline constitution VI already requires of the JWT secret/CORS origin. |
| VI. Auditable & Compliant (C1, C2) | Yes — this is the feature's other core purpose | `withAudit()` is the concrete mechanism that makes the audit-coverage guarantee real rather than aspirational, on both REST and MCP transports alike (per PDR-005). |
| VII. Feature-Gated by Entitlement (G1) | No | This feature adds no UI surface, REST route, or MCP tool — it's infrastructure consumed only by other bounded contexts' own gated features. Nothing here is directly reachable by an end user to gate. |

No violations requiring justification — Complexity Tracking is empty.

### Post-Phase-1 re-check

Re-evaluated after `research.md`, `data-model.md`, `contracts/`, and `quickstart.md` were written: no new violations surfaced. The role-separation and PgBouncer-compatibility decisions in `research.md` strengthen Principles IV/V (they close the exact RLS-bypass and session-leak gaps those principles exist to prevent) rather than introducing new complexity. Testcontainers as a new dev dependency is additive test infrastructure already decided project-wide in `context/testing-strategy.md`, not a deviation introduced by this feature.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
drizzle.config.ts             # drizzle-kit config: schemas, migration output dir, migration-role connection string

drizzle/
└── migrations/                # drizzle-kit generated SQL + meta journal
    └── 0000_create_schemas.sql

src/shared/db/
├── index.ts                   # public barrel — only what other BCs are meant to import
├── client.ts                  # pooled postgres.js client, runtime app-role connection
├── schemas.ts                 # the 7 schema-name constants, used by drizzle.config.ts and column helpers
├── columns.ts                 # standard column builders: id(), organizationId(), timestamps()
├── tenant-context.ts           # withTenantContext(organizationId, fn) — SET LOCAL app.current_org_id
├── with-audit.ts               # withAudit(mutationFn, auditEvent) — atomic mutation + audit insert
├── tenant-context.test.ts      # Testcontainers-backed: RLS allow/deny + MCP-path parity
├── with-audit.test.ts          # Testcontainers-backed: forced audit-insert failure rolls back mutation
└── schemas.test.ts             # Testcontainers-backed: fresh-DB migrate creates all 7 schemas, idempotent re-run
```

**Structure Decision**: Single Next.js project (per `context/repo-structure.md` — no separate backend/frontend split in the new stack). All new code lives under the existing `src/shared/db/` placeholder barrel plus one root-level `drizzle.config.ts` and its generated `drizzle/migrations/` output, matching where `drizzle-kit` conventionally expects to run from a project root. Tests are colocated (`*.test.ts` next to the file they exercise) per `context/testing-strategy.md`, not a parallel `tests/` tree.

## Complexity Tracking

*No violations — table intentionally empty.*
