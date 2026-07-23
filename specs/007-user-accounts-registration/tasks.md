---

description: "Task list for feature implementation"
---

# Tasks: User Accounts & Registration

**Input**: Design documents from `/specs/007-user-accounts-registration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/identity-access-users.md, quickstart.md

**Tests**: Included and REQUIRED — constitution Principle I (Test-First Development) mandates a failing test before any new backend logic in this repo.

**Organization**: Tasks are grouped by user story (spec.md's US1/US2/US3, priority order) so each can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same batch (different files, no dependency on each other)
- **[Story]**: Maps the task to spec.md's US1/US2/US3
- File paths are exact, relative to repo root

## Phase 1: Setup

- [X] T001 Add `bcryptjs` as a dependency (`pnpm add bcryptjs`; add `@types/bcryptjs` as a dev dependency only if `bcryptjs`'s own bundled types aren't picked up) — research.md §1

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `users` table, its repo layer, shared validated-insert core, entitlement-gate stand-in, and the contract-promised `getUser` read. No user story can be verified until this phase is done.

- [X] T002 [P] Add `User`/`UserAccountSummary` types and `DuplicateUserError`, `InvalidTeamAssignmentError`, `WeakPasswordError`, `LastActiveAdminError`, `NotAuthorizedError`, `CrossOrgUserAccessError`, `EntitlementRequiredError` classes in `src/bcs/identity-access/domain/user.ts` (per data-model.md)
- [X] T003 [P] Add the `users` table to `src/bcs/identity-access/infrastructure/schema.ts`: `id`, `organization_id`, `team_id` (FK → `teams.id`), `username`, `display_name`, `email`, `password_hash` (nullable), `role` (enum `admin`/`member`, default `member`), `is_active` (default `true`), timestamps; `(organization_id, email)` and `(organization_id, username)` composite unique constraints. Also update `teams.owner_id` to add its FK (`references((): AnyPgColumn => users.id)`, lazy arrow per the self-referential-FK pattern already used for `parent_team_id`) — completes `006-team-hierarchy`'s deferral
- [X] T004 Generate and review the migration: `MIGRATION_DATABASE_URL=... pnpm db:generate`, rename to `drizzle/migrations/000N_identity_access_users.sql` and update `_journal.json`'s `tag`; confirm both the new table's composite unique constraints and the `teams.owner_id` FK statement are present (depends on T003)
- [X] T005 [P] Implement `users-repo.ts` in `src/bcs/identity-access/infrastructure/users-repo.ts`: `insert` (storing `email`/`username` lowercased), `findById`, `findByOrgAndId` (returns `undefined` if the id exists but belongs to a different org — used for cross-org checks), `update`, `countActiveAdmins(tx, organizationId)`, `listByOrgAndTeam(tx, organizationId, teamId?)` (depends on T004)
- [X] T006 [P] Write failing tests for `assertCoreFeaturesEnabled` in `src/bcs/identity-access/application/entitlement-gate.test.ts`: does not throw while the hardcoded stand-in is enabled; throws `EntitlementRequiredError` when a test-local override/monkeypatch of the stand-in is disabled (depends on T002)
- [X] T007 [P] Implement `entitlement-gate.ts` in `src/bcs/identity-access/application/entitlement-gate.ts`: `assertCoreFeaturesEnabled()` throwing `EntitlementRequiredError` against a hardcoded-`true` local constant (research.md §4) (depends on T006) — makes T006 pass
- [X] T008 Implement the shared, non-authorization-gated core `insertValidatedUser(tx, params)` in `src/bcs/identity-access/application/insert-validated-user.ts`: validates `teamId` belongs to `params.organizationId` (else `InvalidTeamAssignmentError`, mirroring `createTeam`'s existing parent-team check), validates password length ≥ 8 (else `WeakPasswordError`), lowercases `email`/`username`, hashes the password via `bcryptjs` (cost 12), calls `users-repo.insert`, and translates a unique-constraint violation into `DuplicateUserError` (mirroring `create-organization.ts`'s `isUniqueViolation` pattern) (depends on T001, T002, T005)
- [X] T009 [P] Write failing tests for `getUser` in `src/bcs/identity-access/application/get-user.test.ts`: returns the exact `UserSummary` shape (`id`, `orgId`, `teamId`, `role`, `email`) for an existing user; throws for a nonexistent id (depends on T008, for fixture creation via `insertValidatedUser`)
- [X] T010 Implement `getUser(db, userId)` in `src/bcs/identity-access/application/get-user.ts` (depends on T009) — makes T009 pass
- [X] T011 Export `getUser` from `src/bcs/identity-access/index.ts` (depends on T010) — signature matches `bcs/identity-access/CONTRACT.md`'s already-listed `getUser(userId)` entry

**Checkpoint**: `users` table exists via a real migration; shared validated-insert core, entitlement gate, and `getUser` ready for the user-story phases below.

---

## Phase 3: User Story 1 - Org-scoped user identity, not global (Priority: P1) 🎯 MVP

**Goal**: Two different organizations can each create a user with the same email/username with no conflict; a duplicate within one organization is rejected — including when the duplicate differs only by case.

**Independent Test**: Create two organizations, create a user with the same email and username in each, verify both persist. Attempt a second user with the same (or case-varied) email/username inside one organization and verify rejection.

### Tests for User Story 1

- [X] T012 [P] [US1] Write failing tests for `createUser` in `src/bcs/identity-access/application/create-user.test.ts`: (a) two different organizations can each create a user with email `admin@example.com`, no conflict; (b) a second user with the same email within one organization is rejected (`DuplicateUserError`); (c) a second user with the same username within one organization is rejected; (d) `Owner@example.com` collides with an existing `owner@example.com` in the same organization (case-insensitive) (depends on T008)

### Implementation for User Story 1

- [X] T013 [US1] Implement `createUser(tx, actingUser, params)` in `src/bcs/identity-access/application/create-user.ts`: requires `actingUser.role === "admin"` (else `NotAuthorizedError`), derives `organizationId` from `actingUser.orgId` only (never from `params`), delegates to `insertValidatedUser`; returns `{ id: string }` only, per contracts.md (depends on T012) — makes T012 pass
- [X] T014 [US1] Export `createUser` from `src/bcs/identity-access/index.ts` (depends on T013)

**Checkpoint**: US1 independently functional — org-scoped uniqueness (including case-insensitivity) verified.

---

## Phase 4: User Story 2 - Admin manages the user roster (Priority: P2)

**Goal**: Admin-gated create/update/deactivate/list, with `password_hash` never appearing in any shape that could carry it, a last-active-admin deactivation guard, and an 8-character password minimum.

**Independent Test**: As an admin, create a user, update a non-privileged field on that user, deactivate a different user, and list users filtered by team and by organization — verify response shapes and confirm `password_hash` never appears anywhere it could.

### Tests for User Story 2

- [X] T015 [P] [US2] Extend `create-user.test.ts` (`src/bcs/identity-access/application/create-user.test.ts`): rejects a `teamId` from a different organization (`InvalidTeamAssignmentError`); rejects a password under 8 characters (`WeakPasswordError`), no row written; rejects a non-admin `actingUser` (`NotAuthorizedError`) (depends on T013). Note: `createUser`'s return shape is `{ id: string }` only, so a `password_hash`-exclusion assertion here would be a type-level tautology, not a behavioral test — the meaningful runtime checks for that property live in T018/T009 (`listUsers`/`getUser`, which return full-ish objects)
- [X] T016 [P] [US2] Write failing tests for `updateUser` in `src/bcs/identity-access/application/update-user.test.ts`: a user may update their own `displayName`; a non-admin attempting to change their own `role`/`isActive`/`teamId` is rejected (`NotAuthorizedError`); an admin may update any field for any user in their own organization, including `teamId` (rejecting a cross-org `teamId` the same way `createUser` does); a target user in a different organization is rejected (`CrossOrgUserAccessError`) (depends on T005, T002)
- [X] T017 [P] [US2] Write failing tests for `deactivateUser` in `src/bcs/identity-access/application/deactivate-user.test.ts`: admin deactivates a non-last-admin user (`isActive` becomes `false`, row retained); a non-admin caller is rejected; deactivating an organization's last remaining active admin is rejected (`LastActiveAdminError`), no change persists; a target user in a different organization is rejected (`CrossOrgUserAccessError`) (depends on T005, T002)
- [X] T018 [P] [US2] Write failing tests for `listUsers` in `src/bcs/identity-access/application/list-users.test.ts`: returns only the caller's own organization's users; filters correctly by `teamId` when given; returns all org users (across teams) when no filter is given; the returned `UserAccountSummary[]` shape never includes `password_hash` — this is the primary behavioral test for that guarantee (depends on T005)

### Implementation for User Story 2

- [X] T019 [US2] Implement `updateUser(tx, actingUser, targetUserId, fields)` in `src/bcs/identity-access/application/update-user.ts`; returns `Promise<void>` per contracts.md (no response payload to leak `password_hash` from) (depends on T016) — makes T016 pass
- [X] T020 [US2] Implement `deactivateUser(tx, actingUser, targetUserId)` in `src/bcs/identity-access/application/deactivate-user.ts`, using `users-repo.countActiveAdmins` for the last-admin guard; returns `Promise<void>` (depends on T017) — makes T017 pass
- [X] T021 [US2] Implement `listUsers(db, actingUser, filters?)` in `src/bcs/identity-access/application/list-users.ts` (depends on T018) — makes T018 pass
- [X] T022 [US2] Export `updateUser`, `deactivateUser`, `listUsers` from `src/bcs/identity-access/index.ts` (depends on T019, T020, T021)

**Checkpoint**: US2 independently functional — full admin-gated CRUD roster management works, with `password_hash` never exposed by any shape capable of carrying it.

---

## Phase 5: User Story 3 - First-run registration provisions a real admin, not a stub (Priority: P3)

**Goal**: `registerFirstRunAdmin` replaces `bootstrapOrganization`'s test-only stub with a real `Team` + admin `User`, gated on the entitlement stand-in, failing closed if the gate is denied.

**Independent Test**: Start from an empty database, call `registerFirstRunAdmin`, verify exactly one real Organization, root Team, and admin User exist and are correctly linked, with the team's `owner_id` set to the new admin's id.

### Tests for User Story 3

- [X] T023 [P] [US3] Write failing tests for `provisionTeamAndAdmin`/`registerFirstRunAdmin` in `src/bcs/identity-access/application/register-first-run-admin.test.ts`: (a) on a fresh self-hosted install, produces a real `Organization` + root `Team` + admin `User`, with the team's `owner_id` equal to the new user's id; (b) `assertCoreFeaturesEnabled` is called before any row is written (verified via a spy on `entitlement-gate.ts`, asserting call order relative to the DB writes); (c) when `assertCoreFeaturesEnabled` is mocked/monkeypatched to throw `EntitlementRequiredError` (the fail-closed path, spec.md's Edge Case), `registerFirstRunAdmin` propagates the error and zero Organization/Team/User rows are written; (d) if user creation fails partway (e.g. a duplicate admin email against an existing org), the entire transaction rolls back — no Organization, Team, or User row persists (depends on T007, T008, and the existing `bootstrapOrganization`/`createTeam` from `005-org-tenant-model`/`006-team-hierarchy`)

### Implementation for User Story 3

- [X] T024 [US3] Implement `makeProvisionTeamAndAdmin(params)` in `src/bcs/identity-access/application/provision-team-and-admin.ts`: composes the existing `createTeam` + `insertValidatedUser` (role `"admin"`) + `teams-repo.update` (sets the new team's `owner_id` to the new user's id), mirroring the legacy Python `register_admin`'s create-team → create-user → set-owner sequence (research.md §3) (depends on T023)
- [X] T025 [US3] Implement `registerFirstRunAdmin(db, params)` in `src/bcs/identity-access/application/register-first-run-admin.ts`: calls `assertCoreFeaturesEnabled()` first, then `bootstrapOrganization(db, params.organization, makeProvisionTeamAndAdmin(params.team, params.admin))` (depends on T024) — makes T023 pass
- [X] T026 [US3] Export `registerFirstRunAdmin` from `src/bcs/identity-access/index.ts` (depends on T025)

**Checkpoint**: All three user stories independently functional and tested.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 [P] Run `pnpm typecheck` and fix any type errors
- [X] T028 [P] Run `pnpm lint` (including `eslint-plugin-boundaries`) and fix any violations
- [X] T029 Run `pnpm test` and confirm every test under `src/bcs/identity-access/` passes
- [X] T030 Execute `quickstart.md` end-to-end and confirm its listed expected coverage matches reality
- [X] T031 Update `bcs/identity-access/CONTRACT.md`'s Exposed APIs table: add `updateUser`, `deactivateUser`, `listUsers` (roster CRUD) and `registerFirstRunAdmin` (registration composition) rows; confirm `getUser`/`createUser` (already listed) match this feature's actual signatures; correct `getUser`'s description to include `email` (matching the Data Contracts section's `UserSummary`, which already includes it)
- [X] T032 Fix the stale archive link already present in `backlog/002-identity-access/EPIC.md`: item 002 (Team Hierarchy) is checked off and its file already lives at `archive/002-team-hierarchy.md`, but the Features list still links to the pre-archive path `002-team-hierarchy.md` — update the link (unrelated pre-existing bug, matching the exact pattern `CLAUDE.md` already documents for `001-typescript-refactor-foundation/EPIC.md`)
- [X] T033 Move `backlog/002-identity-access/003-user-accounts-and-registration.md` to `backlog/002-identity-access/archive/003-user-accounts-and-registration.md`, set `status: done`, check off every Requirement and Acceptance Criteria bullet (all are satisfied: org-scoped uniqueness, admin-gated CRUD, bcrypt hashing, real `provisionTeamAndAdmin` wiring, and the entitlement gate via its documented temporary stand-in per the requirement's own wording). Update `backlog/002-identity-access/EPIC.md`'s Features list link for item 003 to point at `archive/003-user-accounts-and-registration.md` and check it off (avoiding the exact bug fixed in T032)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user story.
- **User Stories (Phase 3-5)**: All depend on Foundational. US1 (`createUser`) is standalone. US2 extends `createUser`'s test coverage and adds `updateUser`/`deactivateUser`/`listUsers` — depends on Foundational directly (not on US1's implementation, though it reuses the same `createUser` function US1 builds). US3 depends on Foundational (`insertValidatedUser`, `entitlement-gate`) and on the pre-existing `createTeam`/`bootstrapOrganization` from earlier features — not on US1/US2's own code.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T002 and T003 can start in parallel (different files); T004 depends on T003.
- T005 depends on T004; T006 depends on T002; both can then run in parallel with each other.
- T007 depends on T006.
- T008 depends on T001, T002, T005.
- T012 (US1 tests), T016/T017/T018 (US2 tests) all depend only on Foundational (T005/T008/T002) and can be written in parallel across different files — implementation proceeds per-story afterward.
- T023 (US3 tests) depends on Foundational (T007, T008) and can be written in parallel with the US1/US2 test tasks.
- T027, T028 (Polish) can run in parallel.

## Parallel Example: Foundational + all three stories' test-writing

```bash
# After Foundational (T002-T011) is done, launch together:
Task: "Write failing tests for createUser in src/bcs/identity-access/application/create-user.test.ts"
Task: "Write failing tests for updateUser in src/bcs/identity-access/application/update-user.test.ts"
Task: "Write failing tests for deactivateUser in src/bcs/identity-access/application/deactivate-user.test.ts"
Task: "Write failing tests for listUsers in src/bcs/identity-access/application/list-users.test.ts"
Task: "Write failing tests for provisionTeamAndAdmin/registerFirstRunAdmin in src/bcs/identity-access/application/register-first-run-admin.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1) — org-scoped, case-insensitive uniqueness is the specific bug (PDR-003) this feature exists to close; already a working, testable, independently valuable slice.

### Incremental Delivery

1. Setup + Foundational → `users` table exists, tested; `getUser` satisfies `CONTRACT.md`'s promise; entitlement gate has its own red/green cycle.
2. US1 → the core multi-tenancy correctness fix is in place and verified.
3. US2 → full day-to-day admin roster management.
4. US3 → first-run bootstrap produces a real Organization + Team + admin User, closing out `005-org-tenant-model`'s stub, including the fail-closed entitlement path.
5. Polish → typecheck/lint/full test suite/quickstart validation, `CONTRACT.md` updated, both backlog housekeeping fixes applied.
