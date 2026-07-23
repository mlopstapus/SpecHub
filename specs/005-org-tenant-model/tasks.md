---

description: "Task list for feature implementation"
---

# Tasks: Organization Tenant Model

**Input**: Design documents from `/specs/005-org-tenant-model/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/identity-access-organization.md, quickstart.md

**Tests**: Included and REQUIRED — constitution Principle I (Test-First Development) mandates a failing test before any new backend logic in this repo; this is not the optional default.

**Organization**: Tasks are grouped by user story (spec.md's US1/US2/US3, priority order) so each can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same batch (different files, no dependency on each other)
- **[Story]**: Maps the task to spec.md's US1/US2/US3
- File paths are exact, relative to repo root

## Phase 1: Setup

- [X] T001 Confirm local prerequisites are in place: `pnpm install` succeeds and Docker is available for the Testcontainers-backed tests this feature adds (per quickstart.md) — no new dependencies are needed, `drizzle-orm`/`drizzle-kit`/`@testcontainers/postgresql` are already in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `organizations` table, its repo layer, and the two functions every user story exercises (`createOrganization`'s guard mechanism, `getOrganization`). No user story can be verified until this phase is done.

- [X] T002 [P] Add `Organization`/`OrgSummary` types and a `SecondOrganizationNotAllowedError` class in `src/bcs/identity-access/domain/organization.ts` (per data-model.md)
- [X] T003 [P] Add `isSelfHosted()` (reads `STRIPE_ENABLED`, per research.md §1) in `src/bcs/identity-access/domain/deployment-mode.ts`
- [X] T004 [P] Define the `organizations` Drizzle table in `src/bcs/identity-access/infrastructure/schema.ts`: `id`, `name`, `slug` (unique), `plan_id` (nullable uuid, no FK yet), `stripe_customer_id` (nullable text), `created_at`/`updated_at` via `shared/db/columns.ts`'s `id()`/`timestamps()` — no `organization_id`, no RLS policy (data-model.md's documented exception)
- [X] T005 Generate and review the migration: `pnpm db:generate`, confirm `drizzle/migrations/0001_identity_access_organizations.sql` creates the table with a real unique constraint on `slug` (depends on T004)
- [X] T006 [P] Write a failing happy-path test for `createOrganization` (single insert succeeds, no guard/uniqueness edge cases yet) in `src/bcs/identity-access/application/create-organization.test.ts`, using `startTestDb()` per `src/shared/db/tenant-context.test.ts`'s pattern (depends on T005)
- [X] T007 [P] Implement `organizations-repo.ts`: `count()`, `insert()`, `findById()` in `src/bcs/identity-access/infrastructure/organizations-repo.ts` (depends on T004, T005)
- [X] T008 Implement `createOrganization(tx, params)` — acquires a `pg_advisory_xact_lock`, checks `isSelfHosted()` + existing-org count, inserts, throws `SecondOrganizationNotAllowedError` if disallowed — in `src/bcs/identity-access/application/create-organization.ts` (depends on T002, T003, T006, T007) — makes T006 pass
- [X] T009 [P] Write a failing test for `getOrganization` (returns `OrgSummary` only, never `stripe_customer_id`/timestamps; throws on unknown id) in `src/bcs/identity-access/application/get-organization.test.ts` (depends on T005)
- [X] T010 Implement `getOrganization(organizationId)` in `src/bcs/identity-access/application/get-organization.ts` (depends on T007, T009) — makes T009 pass
- [X] T011 Export `getOrganization` from `src/bcs/identity-access/index.ts` (depends on T010)

**Checkpoint**: `organizations` table exists via a real migration; `createOrganization`'s guard mechanism and `getOrganization` both work and are covered by passing tests.

---

## Phase 3: User Story 1 - First-run bootstrap creates the tenant root (Priority: P1) 🎯 MVP

**Goal**: `bootstrapOrganization` creates the Organization row and invokes an injected `provisionTeamAndAdmin` callback in the same transaction, proving FR-004's atomicity mechanism (research.md §2) — the callback stands in for Team/User creation until features 002/003 exist to supply the real one.

**Independent Test**: Against an empty self-hosted database, call `bootstrapOrganization` with a stub `provisionTeamAndAdmin`; verify exactly one Organization row exists and the stub was invoked with that organization's id. Separately, make the stub throw and verify the Organization insert rolls back too.

### Tests for User Story 1

- [X] T012 [US1] Write failing tests in `src/bcs/identity-access/application/bootstrap-organization.test.ts`: (a) empty self-hosted DB → one Organization row created and `provisionTeamAndAdmin` invoked with the correct `organizationId`; (b) `provisionTeamAndAdmin` throws → the Organization insert rolls back too (depends on T008)

### Implementation for User Story 1

- [X] T013 [US1] Implement `bootstrapOrganization(db, params, provisionTeamAndAdmin)` in `src/bcs/identity-access/application/bootstrap-organization.ts`, delegating the guarded insert to `createOrganization` and running the callback in the same transaction (depends on T012) — makes T012 pass
- [X] T014 [US1] Export `bootstrapOrganization` from `src/bcs/identity-access/index.ts` (depends on T013)
- [X] T015 [US1] Add `bootstrapOrganization` to the Exposed APIs table in `bcs/identity-access/CONTRACT.md` per its own Breaking Change Policy (depends on T013)

**Checkpoint**: US1 independently functional — the bootstrap transaction mechanism is proven. Full end-to-end "one org + one real team + one real user" behavior (SC-001) completes once features 002/003 supply a real `provisionTeamAndAdmin` at an actual route-handler call site (quickstart.md's documented scope boundary) — leave that acceptance criterion unchecked in the backlog item, don't treat it as done here.

---

## Phase 4: User Story 2 - Self-hosted installs stay single-tenant (Priority: P2)

**Goal**: Prove the guard built in Foundational (T008) actually rejects a second organization in self-hosted mode, including under concurrent attempts.

**Independent Test**: Seed one organization in a self-hosted-mode test DB; attempt `createOrganization` again directly (no bootstrap/callback machinery needed) and verify it's rejected before any row is written. Fire two concurrent `createOrganization` calls against an empty self-hosted DB and verify exactly one succeeds.

### Tests for User Story 2

- [X] T016 [US2] Write failing tests in `src/bcs/identity-access/application/create-organization.test.ts`: (a) self-hosted mode + one existing organization → second `createOrganization` call throws `SecondOrganizationNotAllowedError`, no new row written; (b) two concurrent `createOrganization` calls against an empty self-hosted DB → exactly one succeeds (depends on T008)

### Implementation for User Story 2

- [X] T017 [US2] Harden `createOrganization`'s advisory-lock/guard logic in `src/bcs/identity-access/application/create-organization.ts` until T016 passes — adjust lock scope/ordering if the concurrency test reveals a race (depends on T016). Additionally scoped the advisory lock to self-hosted mode only — it exists solely to protect the single-org guard's count-then-insert race; unconditionally applying it would have serialized every SaaS-mode organization creation platform-wide behind one global lock, which nothing requires (slug-uniqueness concurrency there is already handled correctly by the DB unique constraint alone)

**Checkpoint**: US2 independently functional and testable without touching US1's bootstrap/callback machinery.

---

## Phase 5: User Story 3 - Organization identity stays unique and unambiguous (Priority: P3)

**Goal**: Prove `slug` uniqueness is enforced at the database level (FR-002), including under concurrent duplicate-slug attempts (SC-003).

**Independent Test**: Attempt to create two organizations with the same slug (sequentially, then concurrently) and verify the second is always rejected, in both self-hosted and non-self-hosted mode.

### Tests for User Story 3

- [X] T018 [P] [US3] Write a failing migration-level test confirming `organizations.slug` has a real unique constraint (via `information_schema`, matching `src/shared/db/columns.test.ts`'s style) in `src/bcs/identity-access/infrastructure/schema.test.ts` (depends on T005)
- [X] T019 [US3] Write failing tests in `src/bcs/identity-access/application/create-organization.test.ts`: (a) duplicate slug is rejected; (b) two concurrent creations with the same slug → exactly one succeeds, the other fails cleanly (depends on T008). Both run with `STRIPE_ENABLED` stubbed to `"true"` (SaaS mode) — under self-hosted mode's default, any second creation attempt is already rejected by the single-org guard regardless of slug, so slug uniqueness is only reachable as a distinct failure mode in SaaS mode

### Implementation for User Story 3

- [X] T020 [US3] In `src/bcs/identity-access/application/create-organization.ts`, map the Postgres unique-violation on `slug` to a clear thrown domain error rather than a raw driver error, until T018/T019 pass (depends on T018, T019). The real error is wrapped as `.cause` on drizzle-orm's `DrizzleQueryError` — `isUniqueViolation()` checks both the top-level and `.cause` shape

**Checkpoint**: All three user stories independently functional and tested.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T021 [P] Run `pnpm typecheck` and fix any type errors introduced by this feature — clean, no errors
- [X] T022 [P] Run `pnpm lint` (including `eslint-plugin-boundaries`) and fix any module-boundary or lint violations — clean, no violations
- [X] T023 Run `pnpm test` and confirm every test under `src/bcs/identity-access/` passes — 43/43 tests pass across 11 files repo-wide (11/11 under `src/bcs/identity-access/` specifically)
- [X] T024 Execute `quickstart.md` end-to-end and confirm its listed expected coverage matches reality — all 7 expected-coverage bullets verified true; fixed quickstart.md's scoped-test command (`pnpm test -- ...` doesn't actually filter, `pnpm vitest run ...` does)
- [X] T025 Update `backlog/002-identity-access/001-organization-tenant-model.md`: check off only the Requirements/Acceptance Criteria this feature actually satisfies (organizations table, slug uniqueness, self-hosted guard, `getOrganization` contract); leave the full "one org + one root team + one admin user — verified by test" criterion unchecked and the item's `status` at `open` (not archived), per `CLAUDE.md`'s partial-completion convention

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user story — the table, `createOrganization`'s guard, and `getOrganization` are shared by all three stories.
- **User Stories (Phase 3-5)**: All depend on Foundational. US1, US2, and US3 do **not** depend on each other — US2 and US3 test `createOrganization` directly, not through US1's `bootstrapOrganization`.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T002, T003, T004 (different files, no interdependency) can run in parallel.
- T006, T007, T009 (different files, all depend only on T004/T005) can run in parallel with each other.
- Once Foundational (Phase 2) is done, US2 (Phase 4) and US3 (Phase 5) are independent in implementation — neither depends on the other or on US1. However, T016 (US2) and T019 (US3) both add cases to the same file (`src/bcs/identity-access/application/create-organization.test.ts`) — sequence those two specifically (one lands, then the other appends) rather than editing concurrently, even though the stories themselves have no logical dependency. US1 (Phase 3) touches entirely separate files and can run fully in parallel with either.
- T021, T022 (Polish) can run in parallel.

## Parallel Example: Foundational Phase

```bash
# After T004/T005 (schema + migration) are done, launch together:
Task: "Write failing happy-path test for createOrganization in src/bcs/identity-access/application/create-organization.test.ts"
Task: "Implement organizations-repo.ts (count/insert/findById) in src/bcs/identity-access/infrastructure/organizations-repo.ts"
Task: "Write failing test for getOrganization in src/bcs/identity-access/application/get-organization.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational) — this alone already delivers a working `organizations` table, the single-org guard, and `getOrganization`.
2. Complete Phase 3 (US1) to add the composable bootstrap transaction.
3. **Note**: unlike a typical MVP, US1 here does not produce a user-facing flow by itself — it's a mechanism other features (002, 003) complete. If a demo is needed sooner, Foundational alone (guard + `getOrganization`) is already independently meaningful and testable.

### Incremental Delivery

1. Setup + Foundational → table, guard, and read contract exist and are tested.
2. Add US1 → bootstrap transaction mechanism proven via stub callback.
3. Add US2 and US3 (any order, or in parallel) → guard and slug-uniqueness behaviors fully proven, including concurrency.
4. Polish → typecheck/lint/full test suite/quickstart validation, backlog item updated (left open, not archived).
