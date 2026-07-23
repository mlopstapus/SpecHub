# Implementation Plan: Team Hierarchy

**Branch**: `006-team-hierarchy` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-team-hierarchy/spec.md`

## Summary

Add `identity_access.teams` as a recursive, organization-scoped hierarchy: `parent_team_id` self-references another team in the same organization, with `getTeamChain` providing the stability-guaranteed self-first/root-last read contract Governance depends on. Reparenting and insert-between both enforce two invariants in the shared application layer — same-organization only, no cycles — with a Postgres advisory lock closing the concurrent-reparent race the same way `005-org-tenant-model` closed the concurrent-bootstrap race.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js >=24 (per `package.json`)

**Primary Dependencies**: `drizzle-orm`/`drizzle-kit` (Postgres schema/migrations), `postgres` (postgres-js driver), Vitest 4 + `@testcontainers/postgresql` for integration tests — all already used by `005-org-tenant-model`, no new dependencies

**Storage**: PostgreSQL, `identity_access` schema, new `teams` table with a self-referential `parent_team_id` and a composite-unique `(organization_id, slug)`

**Testing**: Vitest + `startTestDb()` against real checked-in migrations, matching `005-org-tenant-model`'s established pattern exactly

**Target Platform**: Linux server (Docker Compose / Helm / AWS SaaS) — no platform-specific code

**Project Type**: Bounded-context slice (`src/bcs/identity-access/{domain,application,infrastructure}`) — no UI/REST/MCP route surface of its own (FR-014's scope boundary)

**Performance Goals**: N/A — `getTeamChain` walks a bounded ancestor chain (organizational hierarchies are shallow in practice), not a hot path at this stage

**Constraints**: `owner_id` nullable with no FK (`identity_access.users` doesn't exist until feature 003, research.md §1 mirrors `005-org-tenant-model`'s research.md §4 pattern); no event-bus dispatch for `TeamReparented` (PDR-007, same resolved question as `005-org-tenant-model`); RLS on `teams` is explicitly out of scope — `backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md` owns enabling RLS on every `identity_access.*` table and lists this feature as one of its own dependencies (the reverse direction)

**Scale/Scope**: One table, one migration, cycle-detection + cross-org invariant logic, ~6 new files under `src/bcs/identity-access/`, zero new routes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First**: Every function (CRUD, `getTeamChain`, reparent invariants, insert-between) gets a failing Testcontainers-backed test before implementation, per established precedent. PASS.
- **II. Domain-Driven Bounded Contexts**: All new code lives under `src/bcs/identity-access/{domain,application,infrastructure}`, exported only via `index.ts`. PASS.
- **III. Domain Invariants in the Domain Layer**: Cross-org and cycle invariants live in `application/`, not a route handler — no route handler exists for this feature to leak into (FR-012). PASS.
- **IV. Multi-Tenant Isolation by Default**: `teams` carries a required `organization_id` (M1, app-layer scoping enforced — every query helper takes `organizationId`/derives it from the team row). **RLS (M2) is intentionally not enabled on `teams` by this feature** — `007-tenant-isolation-tests-and-rls.md` explicitly owns enabling RLS across every `identity_access.*` table and depends on this feature, not the reverse. Documented, backlog-confirmed exception — the already-established, correctly-sequenced plan for this epic, not a deviation this feature is choosing ad hoc.
- **V. Secure by Default**: No secrets introduced. PASS.
- **VI. Auditable & Compliant (SOC2)**: Reparenting is not wrapped in `withAudit()` — `audit.audit_events` doesn't exist yet (epic 003, same as `005-org-tenant-model`'s Complexity Tracking). Already tracked in `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`'s retrofit bullet, which lists team creation/reparenting explicitly.
- **VII. Feature-Gated by Entitlement**: No REST/MCP/UI surface added by this feature — nothing to gate yet. Same documented exception pattern as `005-org-tenant-model`, and the same registration-route backlog item (`003-user-accounts-and-registration.md`) already carries the forward-tracking note for when a real route exists.

*Re-checked after Phase 1 design below — no new violations introduced.*

## Project Structure

### Documentation (this feature)

```text
specs/006-team-hierarchy/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── identity-access-team.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/bcs/identity-access/
├── index.ts                          # barrel — adds getTeamChain, createTeam, updateTeam,
│                                      #   reparentTeam, insertTeamBetween, listSubTeams
├── domain/
│   └── team.ts                       # Team/TeamChainEntry types, CrossOrgReparentError, CycleError
├── application/
│   ├── create-team.ts                # createTeam(tx, params)
│   ├── update-team.ts                # updateTeam(tx, teamId, params)
│   ├── reparent-team.ts              # reparentTeam(tx, teamId, newParentId) — invariants + advisory lock
│   ├── insert-team-between.ts        # insertTeamBetween(tx, params, childTeamId)
│   ├── get-team-chain.ts             # getTeamChain(teamId) -> TeamChainEntry[]
│   └── list-sub-teams.ts             # listSubTeams(organizationId, parentTeamId | null)
└── infrastructure/
    ├── schema.ts                     # adds `teams` table (identity_access schema)
    └── teams-repo.ts                 # findById, findByParent, insert, update, updateParent

drizzle/migrations/
└── 0002_identity_access_teams.sql    # generated via `pnpm db:generate`

bcs/identity-access/CONTRACT.md        # updated: getTeamChain already listed; confirm shape matches
```

**Structure Decision**: Same layout and conventions as `005-org-tenant-model` — `src/bcs/identity-access/{domain,application,infrastructure}`, Drizzle schema at `infrastructure/schema.ts` (appending to the existing file's exports, matching `drizzle.config.ts`'s glob), tests colocated as `*.test.ts` using `startTestDb()`.

## Complexity Tracking

> Documented, justified exceptions from the Constitution Check above.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `teams` has no RLS policy yet (Principle IV, M2) | `007-tenant-isolation-tests-and-rls.md` explicitly owns enabling RLS across every `identity_access.*` table and already depends on this feature | Enabling RLS piecemeal per-feature (rather than in the one feature designed to do it consistently, with its own reusable cross-tenant test helper) would duplicate work `007` is specifically scoped to do once, correctly, for every table at once |
| Team reparenting is not wrapped in `withAudit()` (Principle VI) | `audit.audit_events` doesn't exist yet (epic 003) | Same rationale as `005-org-tenant-model`; already tracked as a retrofit requirement |
| No `resolveEntitlements()` gate call (Principle VII) | This feature adds no REST route, MCP tool, or UI surface to gate | Same rationale as `005-org-tenant-model`; forward-tracked in `003-user-accounts-and-registration.md` |
