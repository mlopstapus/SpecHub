# Implementation Plan: Organization Tenant Model

**Branch**: `005-org-tenant-model` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-org-tenant-model/spec.md`

## Summary

Add `identity_access.organizations` as the explicit tenant-root table (PDR-003), with a database-enforced unique `slug`, a self-hosted single-org application guard, and a `getOrganization(organizationId)` read contract returning only the `OrgSummary` shape. The bootstrap orchestration (`bootstrapOrganization`) creates the Organization row transactionally and exposes a composable seam for root-Team/admin-User creation, since those tables belong to features 002 (Team Hierarchy) and 003 (User Accounts & Registration), which depend on this feature rather than the reverse — full end-to-end bootstrap behavior (FR-004, SC-001) completes once those features land and supply the real callback at the actual route-handler call site.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js >=24 (per `package.json`)

**Primary Dependencies**: `drizzle-orm` 0.45 + `drizzle-kit` (Postgres schema/migrations), `postgres` (postgres-js driver), Next.js 16 App Router (no route surface added by this feature), Vitest 4 + `@testcontainers/postgresql` for integration tests

**Storage**: PostgreSQL, `identity_access` Postgres schema (already created by `drizzle/migrations/0000_create_schemas.sql`), new `organizations` table

**Testing**: Vitest, following the existing `src/shared/db/*.test.ts` pattern — `startTestDb()` spins up an ephemeral Testcontainers Postgres instance and applies the real, checked-in `drizzle/migrations/` (unlike `columns.test.ts`'s throwaway-table approach, since `organizations` is a real persistent table this migration set must include)

**Target Platform**: Linux server (Docker Compose locally, Helm/K8s or the AWS SaaS deployment in production) — no platform-specific code

**Project Type**: Single Next.js modular-monolith app; this feature is a bounded-context slice (`src/bcs/identity-access/{domain,application,infrastructure}`) with no UI/REST/MCP route surface of its own

**Performance Goals**: N/A — bootstrap runs at most once per self-hosted install for its lifetime; `getOrganization` is a single primary-key lookup, not a hot path

**Constraints**: No event bus/queue exists (PDR-007) — no async dispatch to build. Neither Billing (epic 008) nor Audit (epic 003) bounded contexts exist yet, so `plan_id`/`stripe_customer_id` get no DB-level FK and organization creation is not wrapped in `withAudit()` (both are explicit, tracked forward dependencies, not gaps to silently work around). Self-hosted vs. managed-SaaS mode is read from the `STRIPE_ENABLED` env var per `context/deployment.md`'s already-documented convention, not a new flag.

**Scale/Scope**: One table, one Postgres migration, ~5 new files under `src/bcs/identity-access/`, zero new routes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First**: Every function below (guard rejection, slug-uniqueness, `getOrganization`, bootstrap atomicity) gets a failing Testcontainers-backed test before implementation, per `src/shared/db/*.test.ts` precedent. PASS.
- **II. Domain-Driven Bounded Contexts**: All new code lives under `src/bcs/identity-access/{domain,application,infrastructure}`, exported only via `index.ts`; no other BC's models are imported. PASS.
- **III. Domain Invariants in the Domain Layer**: The self-hosted single-org guard and slug-uniqueness live in `application`/`infrastructure`, not a route handler — there is no route handler yet for this feature to leak into. PASS.
- **IV. Multi-Tenant Isolation by Default**: `organizations` is the tenant *root*, not a tenant-scoped table — it carries no `organization_id` column and the standard RLS session-variable policy doesn't apply to it (nothing to scope it to), matching the already-established global-table exception pattern (e.g. `billing.plans` in `context/database-conventions.md`). Every other tenant-scoped table's M1/M2/M3 verification remains feature 007's job. Documented exception, see Complexity Tracking.
- **V. Secure by Default**: No secrets are introduced (`stripe_customer_id`/`plan_id` are non-secret pointers). PASS.
- **VI. Auditable & Compliant (SOC2)**: Organization creation is **not** wrapped in `withAudit()` — `audit.audit_events` doesn't exist yet (epic 003 depends on this feature, not the reverse). Tracked explicitly as a retrofit requirement in `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md` (already updated). Documented exception, see Complexity Tracking.
- **VII. Feature-Gated by Entitlement**: This feature adds no REST route, MCP tool, or UI surface — there is nothing yet to gate. The entitlement check applies once features 003/004 build the actual route/tool that calls `bootstrapOrganization`. Documented exception, see Complexity Tracking.

*Re-checked after Phase 1 design below — no new violations introduced by the data model or contracts.*

## Project Structure

### Documentation (this feature)

```text
specs/005-org-tenant-model/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── identity-access-organization.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/bcs/identity-access/
├── index.ts                          # barrel — adds getOrganization, bootstrapOrganization
├── domain/
│   ├── organization.ts               # Organization/OrgSummary types, SecondOrganizationNotAllowedError
│   └── deployment-mode.ts            # isSelfHosted() — reads STRIPE_ENABLED
├── application/
│   ├── bootstrap-organization.ts     # bootstrapOrganization(db, params, provisionTeamAndAdmin)
│   ├── create-organization.ts        # createOrganization(tx, params) — guard + insert
│   └── get-organization.ts           # getOrganization(organizationId) -> OrgSummary
└── infrastructure/
    ├── schema.ts                     # Drizzle `organizations` table (identity_access schema)
    └── organizations-repo.ts         # count(), insert(), findById()

drizzle/migrations/
└── 0001_identity_access_organizations.sql   # generated via `pnpm db:generate`

bcs/identity-access/CONTRACT.md        # updated: add bootstrapOrganization to Exposed APIs
```

**Structure Decision**: Follows the existing `src/bcs/<name>/{domain,application,infrastructure}` layout from `context/repo-structure.md`, matching the module-boundary ESLint config already in place (`eslint.config.mjs`'s `boundaries/elements` treats `src/bcs/*` as a boundary — internal files here may reference each other freely, only `index.ts` is importable from outside). Drizzle schema lives at `src/bcs/identity-access/infrastructure/schema.ts` per the glob already wired in `drizzle.config.ts` (`./src/bcs/*/infrastructure/schema.ts`), not the top-level `bcs/<name>/schema.ts` shown in `repo-structure.md`'s diagram — the config file is the authoritative, current convention.

## Complexity Tracking

> Documented, justified exceptions from the Constitution Check above — not violations requiring a different approach, but deliberate scope boundaries this feature cannot close alone.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `organizations` has no `organization_id` / RLS session-var policy (Principle IV) | It **is** the tenant root — there is no foreign tenant to scope it to | A self-referential "org scoped to itself" policy would be meaningless; matches the pre-existing global-table exception (`billing.plans`) in `context/database-conventions.md` |
| Organization creation is not wrapped in `withAudit()` (Principle VI) | `audit.audit_events` doesn't exist yet — epic 003 (Audit & Compliance) depends on this feature, not the reverse | Building a placeholder audit table now just to satisfy the wrapper would be schema churn thrown away once epic 003 defines the real shape; instead tracked as an explicit requirement in `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md` |
| No `resolveEntitlements()` gate call (Principle VII) | This feature adds no REST route, MCP tool, or UI surface to gate | A gate on a bare application function with no caller is a no-op; applies naturally once features 003/004 build the route/tool that calls `bootstrapOrganization` |
