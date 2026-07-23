# Implementation Plan: Tenant Isolation Tests & RLS

**Branch**: `011-tenant-isolation-rls` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-tenant-isolation-rls/spec.md`

## Summary

Enables Postgres row-level security on all five `identity_access` tables (`organizations`, `teams`, `users`, `invitations`, `api_keys`) as the tenet-M2 backstop behind this bounded context's existing app-layer scoping, and delivers the reusable `assertCrossTenantDenied` test helper every later epic's own tenant-isolation-tests feature will import. Deep investigation during planning (research.md) found that RLS, applied naively, would break four already-shipped flows that must resolve an identity with no organization context yet (`login`, `authenticateSession`, `authenticateApiKey`, `acceptInvitation`) and the self-hosted single-org bootstrap guard — resolved via a second, narrowly-scoped Postgres role (`skillcanon_auth`) rather than weakening the RLS policy itself. The audit also found and closes two real app-layer (M1) scoping gaps (`getUser`, `getTeamChain`) and migrates every existing identity-access test (28 files) to establish tenant context the way a real request will, rather than silently relying on an unscoped connection that RLS is about to make an error.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24 (repo-wide, per `package.json` engines)

**Primary Dependencies**: Drizzle ORM (`drizzle-orm`), `postgres` (postgres-js driver) — no new dependency. Raw SQL migration (RLS policies have no Drizzle schema-builder representation).

**Storage**: PostgreSQL. No new tables/columns — RLS policies and one new role (`skillcanon_auth`) layered onto the five existing `identity_access` tables.

**Testing**: Vitest, Testcontainers-backed (`startTestDb()`), matching every prior feature in this epic. This feature's own new tests: `src/shared/testing/tenant-isolation.ts`'s helper plus one cross-tenant-denial test per resource type (5 total). Existing suite migration: all 28 identity-access test files updated per research.md §4's fixture/function-under-test split — not new tests, but a required correctness fix given RLS's new behavior.

**Target Platform**: Next.js server runtime (Node), self-hosted via Docker Compose or managed SaaS (no SaaS deployment exists yet, per `context/deployment.md`)

**Project Type**: Web application — backend-only, no route/UI. Touches `src/bcs/identity-access/{application,infrastructure}` (signature fixes), `src/shared/db/{client,test-helpers}.ts` (new `authDb`), a new `src/shared/testing/` module, `drizzle/migrations/`, and `docker-compose.yaml`/`.env.example` (see Complexity Tracking — the self-hosted deployment's `DATABASE_URL` does not yet point at the least-privileged app role at all, a pre-existing gap this feature must close for RLS to have any effect in that deployment).

**Performance Goals**: No feature-specific target beyond standard web-app expectations; not otherwise specified by spec.md.

**Constraints**: Every RLS policy is scoped `TO <role>` explicitly, never left to default to `PUBLIC` (data-model.md), so `skillcanon_app`'s restrictive policy and `skillcanon_auth`'s permissive one coexist per table without interference. `skillcanon_auth` is granted SELECT/INSERT/UPDATE (no DELETE) on `identity_access` only — narrower than the migration/owner role's cross-schema DDL+DML reach (research.md §2). No application function's *body* changes to accommodate `skillcanon_auth` except `getUser`/`getTeamChain` (research.md §3) — every credential-resolution/bootstrap function keeps its existing signature, only its caller's choice of connection changes.

**Scale/Scope**: 1 new hand-written migration (`0007_identity_access_rls.sql`, ~10 policies + 1 role-creation block + grants); 2 shared-kernel file additions (`client.ts`, `test-helpers.ts`); 1 new shared test-utility module + its `context/testing-strategy.md` doc addition; 2 application-layer signature changes (`getUser`, `getTeamChain`) + 1 new repo function (`teams-repo.findByOrgAndId`); `bcs/identity-access/CONTRACT.md` updates; ~28 existing test files migrated to the new fixture/function-under-test connection pattern; 5 new cross-tenant-denial tests; `docker-compose.yaml`/`.env.example` updated so the self-hosted `app` service actually connects via `skillcanon_app`/`skillcanon_auth` instead of the Postgres superuser.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First**: Every behavior change (RLS denial per resource type, RLS-as-independent-backstop, `getUser`/`getTeamChain`'s new scoped paths, `skillcanon_auth`-routed flows still working) gets a failing test first, per this epic's established precedent. PASS.
- **II. Domain-Driven Bounded Contexts**: All changes stay within `identity_access`'s own schema/role boundary (`skillcanon_auth` is scoped to `identity_access` only, not a cross-schema mechanism) plus the pre-existing `shared/db` kernel. The new `src/shared/testing/` module is deliberately BC-agnostic (no import from any `bcs/*`), consistent with being a kernel-level utility every future epic imports. PASS.
- **III. Domain Invariants in the Domain Layer**: The "which connection resolves an identity with no org context yet" decision lives in the shared kernel (`client.ts`'s `authDb`) and this BC's own functions, not re-derived per future route handler in `007-distribution` — documented explicitly in contracts/identity-access-rls.md precisely so it isn't rediscovered ad hoc later. PASS.
- **IV. Multi-Tenant Isolation by Default**: This feature *is* the concrete delivery of M1 (closes the `getUser`/`getTeamChain` app-layer gaps), M2 (RLS enabled on all 5 tables, proven independent via FR-007's app-filter-disabled test), and M3 (one cross-tenant-denial test per resource type via the new shared helper). PASS — this is the gate the whole feature exists to satisfy.
- **V. Secure by Default**: `skillcanon_auth` is deliberately narrower than the alternative of reusing the migration/owner role — schema-scoped, no DELETE (research.md §2's "Alternatives considered"). No secret/log-redaction surface is touched by this feature. PASS.
- **VI. Auditable & Compliant (SOC2)**: No new audit-event requirement — confirmed via research (not assumed) that this codebase's existing convention audits mutations, not every read/auth-check/denial (matches `010-api-keys/plan.md`'s same conclusion), and this feature adds no new mutation path of its own. PASS.
- **VII. Feature-Gated by Entitlement**: No new REST route, MCP tool, or UI surface. N/A, matching every prior feature in this epic's own justified deferral to `007-distribution`.

*Re-checked after Phase 1 design below — no new violations introduced by the data model or contracts; the `docker-compose.yaml` fix (Complexity Tracking) is a correction to a pre-existing gap from `005-docker-compose-dev-environment`, not a new deviation this feature introduces.*

## Project Structure

### Documentation (this feature)

```text
specs/011-tenant-isolation-rls/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   ├── identity-access-rls.md
│   └── tenant-isolation-test-helper.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
drizzle/migrations/
└── 0007_identity_access_rls.sql   # hand-written: ENABLE RLS + 2 policies per table (5 tables) + skillcanon_auth role/grants

src/shared/db/
├── client.ts                      # add authDb (AUTH_DATABASE_URL), mirroring db's lazy-init pattern
├── test-helpers.ts                # TestDb gains authDb (role: skillcanon_auth)
└── test-helpers.test.ts           # (if present) extend for the new field — else covered transitively

src/shared/testing/
├── tenant-isolation.ts             # assertCrossTenantDenied
└── tenant-isolation.test.ts        # unit-level coverage of the helper itself (throws vs. resolves-empty cases)

src/bcs/identity-access/
├── application/
│   ├── get-user.ts                 # add optional organizationId param
│   ├── get-user.test.ts            # add scoped + cross-org cases; existing case updated for new param
│   ├── get-team-chain.ts           # add mandatory organizationId param
│   ├── get-team-chain.test.ts      # updated calls + new cross-org case
│   ├── login.test.ts               # migrate to testDb.authDb
│   ├── authenticate-session.test.ts
│   ├── authenticate-api-key.test.ts
│   ├── accept-invitation.test.ts
│   ├── create-organization.test.ts # bootstrap flow migrated to testDb.authDb
│   ├── bootstrap-organization.test.ts
│   └── ... (remaining ~20 test files: fixture calls → testDb.authDb, function-under-test → withTenantContext(testDb.appDb, orgId, ...))
├── infrastructure/
│   ├── teams-repo.ts               # add findByOrgAndId
│   ├── teams-repo.test.ts          # (new, or added to an existing repo test file — none exists today for teams-repo)
│   ├── api-keys-repo.test.ts       # migrate testDb.appDb → testDb.authDb for fixture setup
│   └── invitations-repo.test.ts    # same
├── tenant-isolation.test.ts        # NEW: 5 cross-tenant-denial tests (one per resource type), using the shared helper
└── CONTRACT.md                     # update getUser/getTeamChain signatures; note authDb requirement for the 5 no-context flows

docker-compose.yaml                 # app service: DATABASE_URL → skillcanon_app, add AUTH_DATABASE_URL → skillcanon_auth (MIGRATION_DATABASE_URL unchanged, still the superuser)
.env.example                        # add AUTH_DATABASE_URL entry alongside DATABASE_URL/MIGRATION_DATABASE_URL
context/testing-strategy.md         # add assertCrossTenantDenied usage example (FR-009)
context/database-conventions.md     # note the auth-role exception alongside the existing RLS pattern section
specs/005-org-tenant-model/data-model.md  # update the "no RLS policy" note on organizations — now superseded by this feature (FR-002)
```

**Structure Decision**: No new bounded context, no new top-level directory. This feature is entirely within `identity_access` plus the pre-existing `shared/db` kernel and a new (but architecturally natural) `shared/testing/` kernel module — matching how `002-drizzle-shared-db-kernel` and `003-audit-compliance`-adjacent work have each previously added exactly one new `shared/*` module when the need was genuinely cross-BC, never inside a single `bcs/*` folder.

## Complexity Tracking

> Documented, justified exceptions from the Constitution Check above — not violations requiring a different approach, but deliberate scope boundaries and pre-existing gaps this feature closes rather than working around.

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| New `skillcanon_auth` Postgres role, broader than SELECT-only (SELECT+INSERT+UPDATE across all 5 `identity_access` tables) | Four already-shipped flows (`login`, `authenticateSession`, `authenticateApiKey`, `acceptInvitation`) and the self-hosted bootstrap guard (`createOrganization`'s `count()`) each need to read or write with no tenant context established yet — research.md §2 | A SELECT-only role plus a second, properly-scoped write step (via `withTenantContext` once the org is known) was designed in detail and rejected: it doesn't shrink the role's schema-level reach at all, and for `createOrganization` specifically it would split the advisory-lock-guarded count-then-insert sequence across two connections/transactions, reintroducing the exact TOCTOU race the lock exists to prevent |
| `docker-compose.yaml`'s `app` service `DATABASE_URL` fix (superuser → `skillcanon_app`) | Discovered during planning: the self-hosted deployment's `DATABASE_URL` and `MIGRATION_DATABASE_URL` are currently identical, both pointing at the Postgres superuser — meaning the running app, as configured today, connects as the table owner and RLS would be silently bypassed entirely in that deployment, regardless of how correct this feature's policies are | Leaving it unfixed was rejected outright — an RLS feature that has no effect in the only deployment path that currently exists would not satisfy this feature's own Success Criteria (SC-001/SC-002), which require RLS to actually deny cross-tenant access, not merely have a migration file that defines policies nobody's connection is ever subject to |
| 28 existing test files updated as part of this feature, not left alone | Zero identity-access test files establish tenant context today (`grep -rl withTenantContext src/bcs/identity-access` → no matches); enabling RLS with no further change would make every one of them throw on first query, per the already-proven behavior in `tenant-context.test.ts` | Scoping this feature to "just the migration + 5 new tests" and leaving the existing suite red was rejected — a feature that ships in a state where `pnpm test` fails across an entire bounded context is not done, and masking it by having tests bypass RLS via the owner role (rather than the purpose-built `skillcanon_auth`/`withTenantContext` split) would prove nothing about whether the actual policies are correctly shaped |
