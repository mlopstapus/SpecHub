---

description: "Task list for feature implementation"
---

# Tasks: Tenant Isolation Tests & RLS

**Input**: Design documents from `/specs/011-tenant-isolation-rls/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{identity-access-rls,tenant-isolation-test-helper}.md, quickstart.md

**Tests**: Included and REQUIRED — constitution Principle I mandates a failing test before any new backend logic, and this feature's entire purpose is proving isolation via tests.

**Organization**: Tasks are grouped by user story (spec.md's US1/US2/US3, priority order), but the RLS migration, the new `skillcanon_auth` role/kernel wiring, the `getUser`/`getTeamChain` app-layer fixes, and — critically — migrating all 28 existing identity-access test files to establish tenant context correctly are all Foundational: enabling RLS with no further change makes every existing test throw immediately (research.md §4), so nothing is "done" until the whole suite is green again, not just this feature's own new tests.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same batch (different files, no dependency on each other)
- **[Story]**: Maps the task to spec.md's US1/US2/US3
- File paths are exact, relative to repo root

## Phase 1: Setup

- [X] T001 [P] Add `AUTH_DATABASE_URL` entry to `.env.example`, alongside `DATABASE_URL`/`MIGRATION_DATABASE_URL`, documenting it as the `skillcanon_auth`-role connection used only by credential-resolution/bootstrap flows (data-model.md's Role summary)
- [X] T002 [P] Fix `docker-compose.yaml`'s `app` service: point `DATABASE_URL` at `skillcanon_app` (not the Postgres superuser) and add `AUTH_DATABASE_URL` pointing at `skillcanon_auth`, both against the `database` service, using the same `${VAR:-default}` overridable-credential pattern already used for `POSTGRES_USER`/`POSTGRES_PASSWORD`; leave `MIGRATION_DATABASE_URL` unchanged (plan.md's Complexity Tracking — without this, RLS has no effect in the self-hosted deployment)

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: RLS must actually exist, the new role/kernel wiring must exist, and the two real app-layer gaps must be closed, before any cross-tenant-denial test (US1) or existing-suite test can pass.

- [X] T003 Write the hand-written migration `drizzle/migrations/0007_identity_access_rls.sql` (data-model.md): idempotent `skillcanon_auth` role creation (mirroring `0000_create_schemas.sql`'s `skillcanon_app` block), `GRANT USAGE ON SCHEMA identity_access TO skillcanon_auth`, `GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity_access TO skillcanon_auth`; then per table (`organizations`, `teams`, `users`, `invitations`, `api_keys`): `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, a `tenant_isolation` policy `TO skillcanon_app` (predicate `id = current_setting('app.current_org_id')::uuid` for `organizations`, `organization_id = current_setting('app.current_org_id')::uuid` for the other four), and an `auth_role_bypass` policy `TO skillcanon_auth USING (true) WITH CHECK (true)`; add the matching entry to `drizzle/migrations/meta/_journal.json` (tag `0007_identity_access_rls`, matching `context/database-conventions.md`'s naming convention)
- [X] T004 Update `context/database-conventions.md`'s "Tenant isolation: RLS pattern" section: document the `skillcanon_auth` exception alongside the existing session-variable pattern — what it's for (credential-resolution/bootstrap operations with no org context yet, per FR-010), its narrower schema-only reach versus the migration/owner role, and a pointer to this feature's data-model.md for the exact policy shape (depends on T003)
- [X] T005 [P] Add `authDb` to `src/shared/db/client.ts`: a second lazily-initialized `PostgresJsDatabase` export connected via `getConnectionString("AUTH_DATABASE_URL", ...)`, mirroring `db`'s existing lazy-init/placeholder-guard pattern exactly (depends on T001 for the env var name, not on T003)
- [X] T006 [P] Add `authDb` to `src/shared/db/test-helpers.ts`'s `TestDb` interface and `startTestDb()`: a third `createRoleClient` connection using role `skillcanon_auth` / password `changeme_in_production` against the same ephemeral container, alongside the existing `ownerDb`/`appDb` (depends on T003 for the role to exist once migrations run)
- [X] T007 [P] Add `findByOrgAndId(tx, organizationId, id)` to `src/bcs/identity-access/infrastructure/teams-repo.ts`, mirroring `users-repo`/`invitations-repo`/`api-keys-repo`'s existing implementations exactly (returns `undefined` if the id belongs to a different organization or doesn't exist)
- [X] T008 Update `getUser` in `src/bcs/identity-access/application/get-user.ts` to `getUser(db, userId, organizationId?)`: when `organizationId` is given, look up via `users-repo.findByOrgAndId`; when omitted, keep today's unscoped `findById` (contracts/identity-access-rls.md); update `src/bcs/identity-access/application/get-user.test.ts`'s existing cases for the new param and add a case proving a cross-org `userId` (organizationId given) throws the same as a nonexistent one (depends on T003, T006 for real-RLS-backed test coverage)
- [X] T009 Update `getTeamChain` in `src/bcs/identity-access/application/get-team-chain.ts` to `getTeamChain(db, organizationId, teamId)` (mandatory param), using the new `teams-repo.findByOrgAndId` for the starting lookup only (contracts/identity-access-rls.md); update `src/bcs/identity-access/application/get-team-chain.test.ts`'s existing calls and add a case proving a cross-org `teamId` throws the same as a nonexistent one (depends on T003, T007)
- [X] T010 [P] Implement `assertCrossTenantDenied` in `src/shared/testing/tenant-isolation.ts` per contracts/tenant-isolation-test-helper.md's signature, plus its own unit tests in `src/shared/testing/tenant-isolation.test.ts` (a fake `fetchResourceById` that throws passes; one that resolves a truthy value fails the assertion with a message naming the two organizations) — no DB dependency for these unit tests
- [X] T011 Add a runnable usage example of `assertCrossTenantDenied` to `context/testing-strategy.md`'s existing "The M3 cross-tenant-denial pattern" section (FR-009), matching contracts/tenant-isolation-test-helper.md's example (depends on T010)
- [X] T012 Update `specs/005-org-tenant-model/data-model.md`'s `organizations` table note: the "Not applied to this table" RLS exception is now superseded by this feature (FR-002) — replace with a pointer to this feature's data-model.md
- [X] T013 Update `bcs/identity-access/CONTRACT.md`'s Exposed APIs table: `getUser(userId)` → `getUser(userId, organizationId?)`, `getTeamChain(teamId)` → `getTeamChain(organizationId, teamId)`; add a note next to `login`/`authenticateSession`/`authenticateApiKey`/`acceptInvitation` (and the bootstrap-organization path) that they must be called via the `skillcanon_auth`-connected client, not the ordinary one (contracts/identity-access-rls.md) (depends on T008, T009)

### Existing test suite migration (blocking — required for `pnpm test` to pass once T003 lands)

Two patterns, per research.md §4:

**Pattern A — "no tenant context yet" flows**: every `testDb.appDb` reference in the file becomes `testDb.authDb` (fixture setup *and* the function-under-test call) — these functions already run entirely through the auth role in production, so this is a straight connection swap, no `withTenantContext` needed anywhere in the file.

**Pattern B — "authenticated user acting in their own org" flows**: fixture/setup calls (creating the org/team/user/invitation/API-key scaffolding a test needs) switch from `testDb.appDb` to `testDb.authDb`; the function-under-test call (and any assertion query reading back its effect) is wrapped in `withTenantContext(testDb.appDb, knownOrgId, tx => ...)` instead of a bare `testDb.appDb`/`testDb.appDb.transaction(...)` call.

- [X] T014 [P] Migrate `src/bcs/identity-access/application/login.test.ts` — Pattern A
- [X] T015 [P] Migrate `src/bcs/identity-access/application/authenticate-session.test.ts` — Pattern A
- [X] T016 [P] Migrate `src/bcs/identity-access/application/authenticate-api-key.test.ts` — Pattern A
- [X] T017 [P] Migrate `src/bcs/identity-access/application/accept-invitation.test.ts` — Pattern A
- [X] T018 [P] Migrate `src/bcs/identity-access/application/create-organization.test.ts` — Pattern A
- [X] T019 [P] Migrate `src/bcs/identity-access/application/bootstrap-organization.test.ts` — Pattern A
- [X] T020 [P] Migrate `src/bcs/identity-access/application/register-first-run-admin.test.ts` — Pattern A (confirm first: this wraps the bootstrap flow, per `application/register-first-run-admin.ts`)
- [X] T021 [P] Migrate `src/bcs/identity-access/application/create-team.test.ts` — Pattern B
- [X] T022 [P] Migrate `src/bcs/identity-access/application/create-user.test.ts` — Pattern B
- [X] T023 [P] Migrate `src/bcs/identity-access/application/deactivate-user.test.ts` — Pattern B
- [X] T024 [P] Migrate `src/bcs/identity-access/application/get-organization.test.ts` — Pattern B
- [X] T025 [P] Migrate `src/bcs/identity-access/application/insert-team-between.test.ts` — Pattern B
- [X] T026 [P] Migrate `src/bcs/identity-access/application/invite-user.test.ts` — Pattern B
- [X] T027 [P] Migrate `src/bcs/identity-access/application/list-api-keys.test.ts` — Pattern B
- [X] T028 [P] Migrate `src/bcs/identity-access/application/list-invitations.test.ts` — Pattern B
- [X] T029 [P] Migrate `src/bcs/identity-access/application/list-sub-teams.test.ts` — Pattern B
- [X] T030 [P] Migrate `src/bcs/identity-access/application/list-users.test.ts` — Pattern B
- [X] T031 [P] Migrate `src/bcs/identity-access/application/logout.test.ts` — Pattern B (or leave unchanged if `logout` touches no RLS-protected table — confirm against `application/logout.ts` first)
- [X] T032 [P] Migrate `src/bcs/identity-access/application/reparent-team.test.ts` — Pattern B
- [X] T033 [P] Migrate `src/bcs/identity-access/application/revoke-api-key.test.ts` — Pattern B
- [X] T034 [P] Migrate `src/bcs/identity-access/application/revoke-invitation.test.ts` — Pattern B
- [X] T035 [P] Migrate `src/bcs/identity-access/application/update-team.test.ts` — Pattern B
- [X] T036 [P] Migrate `src/bcs/identity-access/application/update-user.test.ts` — Pattern B
- [X] T037 [P] Migrate `src/bcs/identity-access/application/create-api-key.test.ts` — Pattern B
- [X] T038 [P] Migrate `src/bcs/identity-access/infrastructure/api-keys-repo.test.ts` — Pattern B (fixture-only file: all `testDb.appDb` → `testDb.authDb`)
- [X] T039 [P] Migrate `src/bcs/identity-access/infrastructure/invitations-repo.test.ts` — Pattern B (fixture-only file: all `testDb.appDb` → `testDb.authDb`)

**Checkpoint**: `pnpm vitest run src/bcs/identity-access` passes in full, with RLS live. Every user story below can now proceed.

---

## Phase 3: User Story 1 - RLS backstop proves cross-tenant leakage is structurally impossible (Priority: P1) 🎯 MVP

**Goal**: For each of the 5 resource types, prove a session scoped to organization A cannot read or write organization B's row by id — and that this holds even with the application-layer `organization_id` filter deliberately bypassed.

**Independent Test**: Create org A and org B (via `authDb`), one resource of each type in org B, and confirm `withTenantContext(appDb, orgA, tx => ...)` denies both an app-layer-function read and a raw, unfiltered Drizzle query for that resource's id.

### Tests for User Story 1

- [X] T040 [US1] Write `src/bcs/identity-access/tenant-isolation.test.ts` with one `describe` block per resource type, each using `assertCrossTenantDenied` twice — once through the app-layer-scoped accessor below, once via a raw, deliberately-unfiltered `tx.select().from(<table>).where(eq(<table>.id, resourceId))` inside the same `withTenantContext(testDb.appDb, orgA, ...)` call, proving RLS denies it with no app-layer filter present at all (FR-007). App-layer accessor per resource type (pinned down, not left as an implementation choice): `organizations` → `getOrganization`; `teams` → `getTeamChain`; `users` → `getUser(db, id, orgA)`; `invitations` → `invitations-repo.findByOrgAndId` (imported directly, matching this suite's existing precedent of exercising a repo function directly rather than only through an application function); `api_keys` → `api-keys-repo.findByOrgAndId` (depends on Foundational T003–T013)

### Implementation for User Story 1

- [X] T041 [US1] If T040 surfaces anything not already covered by the pinned accessors above (e.g. a resource type needs a small fixture-creation helper local to the test file), add it directly in `tenant-isolation.test.ts` rather than adding new application-layer surface (keeps this story's scope to proving denial, not designing new reads)

**Checkpoint**: US1 independently functional — every resource type has a passing, real-RLS-backed cross-tenant-denial test, including the app-filter-disabled case.

---

## Phase 4: User Story 2 - Reusable cross-tenant-denial test helper (Priority: P1)

**Goal**: `assertCrossTenantDenied` is implemented, documented, and demonstrably usable by someone who didn't build it.

**Independent Test**: `context/testing-strategy.md`'s usage example, followed with no other context, is enough to write a passing cross-tenant-denial test for a new resource type.

**Note**: The helper's implementation (T010) and doc addition (T011) are already delivered in Foundational, since US1's own tests depend on them existing first. This phase's remaining work is validating the helper stands on its own.

### Tests for User Story 2

- [X] T042 [US2] Confirm `tenant-isolation.test.ts` (T040) imports `assertCrossTenantDenied` only from `@/shared/testing/tenant-isolation` (not re-implemented or duplicated inline) — a lightweight review/assertion pass, not new test code

### Implementation for User Story 2

- [X] T043 [US2] Re-read `context/testing-strategy.md`'s updated section (T011) and `contracts/tenant-isolation-test-helper.md` as if encountering them fresh; confirm no missing import path, no undocumented parameter, and no reference to this feature's own internal file layout that a later epic's engineer wouldn't have — fix the doc if anything is missing

**Checkpoint**: US2 independently functional — the helper is real, tested, and documented for reuse by `004-governance`/`005-prompt-registry`/`006-workflow-orchestration`.

---

## Phase 5: User Story 3 - Audited proof that every existing query is org-scoped (Priority: P2)

**Goal**: A durable record that every service-layer query in this epic's prior features was reviewed for `organization_id` filtering, with every gap found fixed.

**Independent Test**: The two gaps this feature's own planning-phase audit found (`getUser`, `getTeamChain`) are fixed (already done in Foundational T008/T009); no further gap is found on a final pass.

### Implementation for User Story 3

- [X] T044 [US3] Re-review every `identity-access` repo function (`organizations-repo.ts`, `teams-repo.ts`, `users-repo.ts`, `invitations-repo.ts`, `api-keys-repo.ts`) and every application-layer function's use of them, confirming each accepts and applies an `organizationId`/`actingUser.orgId` filter in its query except the documented, justified exceptions (`login`'s `findByEmail`, `authenticateSession`'s/`authenticateApiKey`'s/`acceptInvitation`'s pre-auth lookups, `getOrganization`'s self-only design) — record the result (pass/fail per function) directly in this feature's `research.md` as a dated confirmation, rather than a separate new document
- [X] T045 [US3] If T044 finds anything beyond what research.md §3 already documents, fix it following the same pattern as `getUser`/`getTeamChain` (scoped repo lookup, same not-found-equivalent denial semantics) and add it to data-model.md's contract-changes table

**Checkpoint**: All three user stories independently functional and tested; the audit this feature's Requirements call for is a real, dated record, not an assumption.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T046 [P] Run `pnpm typecheck` and fix any type errors
- [X] T047 [P] Run `pnpm lint` (including `eslint-plugin-boundaries`) and fix any violations
- [X] T048 Run `pnpm test` and confirm the entire suite passes, not just `src/bcs/identity-access`
- [X] T049 Execute `quickstart.md`'s scenarios in order and confirm every listed expected outcome matches reality, including the optional manual sanity check against a running `docker compose` Postgres
- [X] T050 Update `backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md`: check off every Requirements/Acceptance Criteria bullet actually delivered; add a Technical Notes entry documenting the `skillcanon_auth` role decision and the `docker-compose.yaml` fix (depends on T046–T049)
- [X] T051 Move `backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md` to `backlog/002-identity-access/archive/007-tenant-isolation-tests-and-rls.md`, set `status: done`; update `backlog/002-identity-access/EPIC.md`'s Features list link for item 007 to point at `archive/007-tenant-isolation-tests-and-rls.md` and check it off (depends on T050)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: T003 (migration) blocks T004, T006, T008, T009, and every existing-suite migration task (T014–T039) — none of those tests pass against a schema without RLS/the new role. T005/T007/T010 are independent of T003 and of each other. T008/T009 depend on T003+T006/T007. The existing-suite migration tasks (T014–T039) all depend on T003 (and T006 for `authDb` to exist) but are independent of *each other* — all `[P]`.
- **User Stories (Phase 3-5)**: All depend on Foundational completing (specifically T003–T013 and the full existing-suite migration, since a red suite blocks any new-test checkpoint from meaning anything). US1/US2 are tightly coupled (US1's tests literally import US2's deliverable) but the work items are already separated by what's newly built (Foundational + US1's test file) vs. validated-for-reuse (US2's phase). US3 depends only on Foundational's own audit fixes already having landed.
- **Polish (Phase 6)**: Depends on all three user stories.

### Parallel Opportunities

- T001, T002 (Setup) — different files.
- T005, T007, T010 (Foundational) — independent of T003 and each other.
- T014–T039 (existing-suite migration) — 26 different files, fully parallelizable once T003/T006 land.
- T046, T047 (Polish) — independent.

## Parallel Example: Existing test-suite migration, once T003/T006 land

```bash
Task: "Migrate src/bcs/identity-access/application/create-team.test.ts — Pattern B"
Task: "Migrate src/bcs/identity-access/application/update-user.test.ts — Pattern B"
Task: "Migrate src/bcs/identity-access/application/login.test.ts — Pattern A"
Task: "Migrate src/bcs/identity-access/infrastructure/api-keys-repo.test.ts — Pattern B"
# ...all 26 files together; none depends on another
```

## Implementation Strategy

### MVP First (Foundational + User Story 1)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational) — this alone delivers working RLS, the `skillcanon_auth` role, the two closed app-layer gaps, and a fully green existing suite under real RLS. This is the load-bearing, highest-risk part of the feature.
2. Complete Phase 3 (US1) — the actual cross-tenant-denial proof per resource type, the feature's headline deliverable.

### Incremental Delivery

1. Setup → env var + docker-compose wiring in place (no behavior change yet).
2. Foundational → migration, new role, kernel wiring, `getUser`/`getTeamChain` fixed, shared helper built, entire existing suite passing under real RLS.
3. US1 → per-resource-type cross-tenant-denial proof, including the app-filter-disabled case.
4. US2 → helper validated as genuinely reusable by a fresh reader.
5. US3 → the audit is a dated, recorded fact, not an assumption.
6. Polish → typecheck/lint/full suite/quickstart validation, `CONTRACT.md`/backlog updated and archived.
