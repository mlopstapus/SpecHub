---

description: "Task list for feature implementation"
---

# Tasks: Team Hierarchy

**Input**: Design documents from `/specs/006-team-hierarchy/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/identity-access-team.md, quickstart.md

**Tests**: Included and REQUIRED — constitution Principle I (Test-First Development) mandates a failing test before any new backend logic in this repo.

**Organization**: Tasks are grouped by user story (spec.md's US1/US2/US3/US4, priority order) so each can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same batch (different files, no dependency on each other)
- **[Story]**: Maps the task to spec.md's US1/US2/US3/US4
- File paths are exact, relative to repo root

## Phase 1: Setup

- [X] T001 Confirm local prerequisites: `pnpm install` succeeds, Docker available for Testcontainers-backed tests — no new dependencies needed beyond what `005-org-tenant-model` already added

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `teams` table and its repo layer. No user story can be verified until this phase is done.

- [X] T002 [P] Add `Team`/`TeamChainEntry` types and `CrossOrgReparentError`/`CycleError` classes in `src/bcs/identity-access/domain/team.ts` (per data-model.md)
- [X] T003 Add the `teams` table to `src/bcs/identity-access/infrastructure/schema.ts`: `id`, `organization_id`, `name`, `slug`, `description`, `owner_id` (nullable uuid, no FK), `parent_team_id` (nullable self-FK), timestamps; `(organization_id, slug)` composite unique constraint
- [X] T004 Generate and review the migration: `MIGRATION_DATABASE_URL=... pnpm db:generate`, rename to `drizzle/migrations/000N_identity_access_teams.sql` and update `_journal.json`'s `tag`, confirm the composite unique constraint and self-referential FK exist (depends on T003)
- [X] T005 [P] Implement `teams-repo.ts`: `findById`, `findByParent` (including `null` for root-level), `insert`, `update`, `updateParent` in `src/bcs/identity-access/infrastructure/teams-repo.ts` (depends on T004)

**Checkpoint**: `teams` table exists via a real migration; repo layer ready for application-layer functions.

---

## Phase 3: User Story 1 - Build an organization's team structure (Priority: P1) 🎯 MVP

**Goal**: Create and update teams, list sub-teams / root-level teams.

**Independent Test**: Create several teams in one organization, some nested, verify individual retrieval and correct sub-team/root-team listing.

### Tests for User Story 1

- [X] T006 [P] [US1] Write failing tests for `createTeam` in `src/bcs/identity-access/application/create-team.test.ts`: root-level team creation; nested team creation (with parent); rejects a parent from a different organization (depends on T005)
- [X] T007 [P] [US1] Write failing tests for `updateTeam` in `src/bcs/identity-access/application/update-team.test.ts`: updates name/description/owner, hierarchy position unchanged (depends on T005)
- [X] T008 [P] [US1] Write failing tests for `listSubTeams` in `src/bcs/identity-access/application/list-sub-teams.test.ts`: lists immediate sub-teams of a parent; lists root-level teams when `parentTeamId` is `null` (depends on T005)

### Implementation for User Story 1

- [X] T009 [US1] Implement `createTeam(tx, params)` in `src/bcs/identity-access/application/create-team.ts` (depends on T006) — makes T006 pass
- [X] T010 [US1] Implement `updateTeam(tx, teamId, params)` in `src/bcs/identity-access/application/update-team.ts` (depends on T007) — makes T007 pass
- [X] T011 [US1] Implement `listSubTeams(organizationId, parentTeamId)` in `src/bcs/identity-access/application/list-sub-teams.ts` (depends on T008) — makes T008 pass
- [X] T012 [US1] Export `createTeam`, `updateTeam`, `listSubTeams` from `src/bcs/identity-access/index.ts` (depends on T009, T010, T011)

**Checkpoint**: US1 independently functional — team structure can be built and queried.

---

## Phase 4: User Story 2 - Resolve a team's full lineage (Priority: P2)

**Goal**: `getTeamChain` returns the stability-guaranteed self-first/root-last ordering.

**Independent Test**: Multi-level hierarchy, request chain for the bottom team, verify exact ordering; matches a characterization fixture derived from the current Python implementation.

### Tests for User Story 2

- [X] T013 [US2] Write failing tests for `getTeamChain` in `src/bcs/identity-access/application/get-team-chain.test.ts`: four-level hierarchy returns self-first/root-last; root-level team returns itself only; throws on nonexistent team; matches a characterization fixture mirroring current Python `team_service.get_team_chain`'s behavior for an equivalent hierarchy shape (research.md §6) (depends on T009 to build fixture data via `createTeam`)

### Implementation for User Story 2

- [X] T014 [US2] Implement `getTeamChain(teamId)` in `src/bcs/identity-access/application/get-team-chain.ts` (depends on T013) — makes T013 pass
- [X] T015 [US2] Export `getTeamChain` from `src/bcs/identity-access/index.ts` (depends on T014) — confirm signature matches `bcs/identity-access/CONTRACT.md`'s existing listing exactly (no CONTRACT.md edit needed if unchanged)

**Checkpoint**: US2 independently functional — Governance's dependency is satisfiable.

---

## Phase 5: User Story 3 - Reorganize teams without corrupting the hierarchy (Priority: P3)

**Goal**: `reparentTeam` enforces same-organization and no-cycle invariants, safely under concurrency.

**Independent Test**: Attempt cross-org reparent (rejected); attempt cycle-creating reparent (rejected); two concurrent conflicting reparents (exactly one succeeds).

### Tests for User Story 3

- [X] T016 [US3] Write failing tests for `reparentTeam` in `src/bcs/identity-access/application/reparent-team.test.ts`: (a) cross-organization reparent rejected, no row changes; (b) cycle-creating reparent rejected, no row changes; (c) valid reparent succeeds and `getTeamChain` reflects new lineage immediately; (d) reparenting to the team's own current parent succeeds as a no-op; (e) two concurrent reparents that would jointly create a cycle — exactly one succeeds (depends on T009, T014 for fixture setup and chain verification)

### Implementation for User Story 3

- [X] T017 [US3] Implement `reparentTeam(tx, teamId, newParentId)` in `src/bcs/identity-access/application/reparent-team.ts`: organization-scoped advisory lock, same-org check, cycle check via ancestor walk (research.md §2/§3), update (depends on T016) — makes T016 pass
- [X] T018 [US3] Export `reparentTeam` from `src/bcs/identity-access/index.ts` (depends on T017)

**Checkpoint**: US3 independently functional and tested for concurrency.

---

## Phase 6: User Story 4 - Insert a new team into an existing hierarchy (Priority: P4)

**Goal**: `insertTeamBetween` composes team creation and reparenting to splice a new team into an existing link.

**Independent Test**: Existing team Y with parent Z; insert new team between them; verify new team's parent is Z and Y's parent is the new team; every other team unaffected.

### Tests for User Story 4

- [X] T019 [US4] Write failing tests for `insertTeamBetween` in `src/bcs/identity-access/application/insert-team-between.test.ts`: (a) splices correctly into an existing parent-child link; (b) works when the child is currently root-level (new team becomes the new root); (c) rejects a nonexistent child team, no team created; (d) every other team in a larger fixture hierarchy is unaffected (depends on T009, T017)

### Implementation for User Story 4

- [X] T020 [US4] Implement `insertTeamBetween(tx, params, childTeamId)` in `src/bcs/identity-access/application/insert-team-between.ts`, composing `createTeam` + `reparentTeam` (depends on T019) — makes T019 pass
- [X] T021 [US4] Export `insertTeamBetween` from `src/bcs/identity-access/index.ts` (depends on T020)

**Checkpoint**: All four user stories independently functional and tested.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T022 [P] Run `pnpm typecheck` and fix any type errors
- [X] T023 [P] Run `pnpm lint` (including `eslint-plugin-boundaries`) and fix any violations
- [X] T024 Run `pnpm test` and confirm every test under `src/bcs/identity-access/` passes
- [X] T025 Execute `quickstart.md` end-to-end and confirm its listed expected coverage matches reality
- [X] T026 Update `bcs/identity-access/CONTRACT.md`'s Exposed APIs table: add `updateTeam`, `reparentTeam`, `insertTeamBetween`, `listSubTeams` (only `getTeamChain`/`createTeam` were already listed)
- [X] T027 Update `backlog/002-identity-access/002-team-hierarchy.md`: checked off all Requirements and 3/4 Acceptance Criteria this feature satisfies. **Not fully done**: the `TeamReparented`/Audit acceptance criterion stays unchecked (per PDR-007, no event bus exists; audit logging is a forward dependency of epic 003 — already tracked in `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`'s retrofit bullet, extended to explicitly name reparenting). Per this repo's convention, the item is **not archived** and `status` stays `open`

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user story.
- **User Stories (Phase 3-6)**: All depend on Foundational. US1 has no dependency on US2/US3/US4. US2 (`getTeamChain`) is needed by US3's tests (to verify chain reflects reparenting) and by US4's tests (to verify splice correctness) — but US2's own implementation only depends on Foundational + US1's `createTeam` (for building test fixtures), not on US3/US4.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Parallel Opportunities

- T002 and T003 can start in parallel (different files); T004 depends on T003.
- T005 depends on T004.
- T006, T007, T008 (different files, all depend only on T005) can run in parallel with each other.
- US1 (Phase 3) can complete independently; US2 (Phase 4) needs US1's `createTeam` for fixtures but not US1's `updateTeam`/`listSubTeams`.
- US3 (Phase 5) and US4 (Phase 6) both build on US1 (`createTeam`) and US2 (`getTeamChain`) for their own tests' fixture/verification needs — implement US2 before US3/US4, but US3 and US4 can then proceed in parallel with each other (US4 depends on US3's `reparentTeam` function directly, so strictly: US3 before US4).
- T022, T023 (Polish) can run in parallel.

## Parallel Example: Foundational + User Story 1 tests

```bash
# After T005 (repo layer) is done, launch together:
Task: "Write failing tests for createTeam in src/bcs/identity-access/application/create-team.test.ts"
Task: "Write failing tests for updateTeam in src/bcs/identity-access/application/update-team.test.ts"
Task: "Write failing tests for listSubTeams in src/bcs/identity-access/application/list-sub-teams.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1) — team creation/update/listing already delivers a working, testable hierarchy structure, even before chain resolution or reparenting exist.

### Incremental Delivery

1. Setup + Foundational → `teams` table exists, tested.
2. US1 → team structure buildable and queryable.
3. US2 → `getTeamChain` satisfies Governance's dependency (the highest-priority read contract).
4. US3 → reparenting works safely, including under concurrency.
5. US4 → insert-between composes the above two.
6. Polish → typecheck/lint/full test suite/quickstart validation, CONTRACT.md updated, backlog item updated.
