---

description: "Task list for feature implementation"
---

# Tasks: API Keys

**Input**: Design documents from `/specs/010-api-keys/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/identity-access-api-keys.md, quickstart.md

**Tests**: Included and REQUIRED — constitution Principle I (Test-First Development) mandates a failing test before any new backend logic in this repo.

**Organization**: Tasks are grouped by user story (spec.md's US1/US2/US3/US4, priority order) so each can be implemented and verified independently. The `identity_access.api_keys` table and its repo, plus the domain types/errors, are foundational since every user story reads or writes them. No new dependency or environment variable is needed (research.md §3), so there is no separate Setup phase — Foundational work starts at T001.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same batch (different files, no dependency on each other)
- **[Story]**: Maps the task to spec.md's US1/US2/US3/US4
- File paths are exact, relative to repo root

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The `api-key` domain types/errors/pure functions, the `identity_access.api_keys` table + migration, and the api-keys repo — every user story needs all of these.

- [X] T001 [P] Add `ApiKey`, `ApiKeySummary` types, `isValidScopeShape`, `isScopeAllowedForRole`, and the error classes (`NoScopesSelectedError`, `InvalidScopeError`, `ScopeExceedsPermissionsError`, `ApiKeyNotFoundError`) in `src/bcs/identity-access/domain/api-key.ts` (data-model.md; no separate domain test file, matching this bounded context's existing precedent of `domain/invitation.ts` — these are exercised through the application-layer tests below)
- [X] T002 [P] Add the `api_keys` table to `src/bcs/identity-access/infrastructure/schema.ts`: `id`, `organization_id` (not null, no FK), `user_id` (FK → `users.id`), `name`, `key_hash` (unique), `prefix`, `scopes` (jsonb), `expires_at` (nullable), `is_active` (default `true`), `last_used_at` (nullable), `created_at`/`updated_at`; add a non-unique index on `(organization_id, user_id)` (data-model.md)
- [X] T003 Generate and review the migration: `MIGRATION_DATABASE_URL=... pnpm db:generate`, rename to `drizzle/migrations/0006_identity_access_api_keys.sql` and update `_journal.json`'s `tag` per `context/database-conventions.md`; confirm the unique `key_hash` constraint, the `user_id` FK, and the `(organization_id, user_id)` index are present (depends on T002)
- [X] T004 [P] Write failing tests for `api-keys-repo` in `src/bcs/identity-access/infrastructure/api-keys-repo.test.ts` (Testcontainers, `startTestDb()`): `insert` returns the generated id (and accepts an optional client-supplied id, matching `invitations-repo`'s pattern); `findByHash` returns the matching row or `undefined` for no match; `findByOrgAndId` returns `undefined` when the id belongs to a different organization (M3); `listByOrgAndUser` returns only that user's keys, newest first; `updateLastUsedAt` sets `last_used_at`; `markRevoked` sets `is_active` to `false` (depends on T003)
- [X] T005 Implement `api-keys-repo.ts` in `src/bcs/identity-access/infrastructure/api-keys-repo.ts`: `insert`, `findByHash`, `findByOrgAndId`, `listByOrgAndUser`, `updateLastUsedAt`, `markRevoked` (depends on T004) — makes T004 pass
- [X] T006 [P] Add `api_keys`-table constraint assertions to `src/bcs/identity-access/infrastructure/schema.test.ts` (real migration, matching the file's existing style): unique constraint on `key_hash`; `user_id` foreign key present; `organization_id` is not-null with no foreign key, matching every other `organization_id` column in this schema (depends on T003)

**Checkpoint**: API key domain types, the table/migration, and the repo are all in place and tested. Every user story below can now proceed.

---

## Phase 2: User Story 1 - Generate an API key for programmatic access (Priority: P1) 🎯 MVP

**Goal**: Any authenticated user can create a scoped API key for themselves; the raw value is returned once and never again; zero-scope and out-of-permission scope requests are rejected.

**Independent Test**: Call `createApiKey(db, actingUser, { name, scopes })` as an admin and as a member with only `:read` scopes and confirm both succeed with a raw key returned exactly once; confirm a member requesting a `:write`/`:run` scope, a request with zero scopes, and a malformed scope string are all rejected with the correct error.

### Tests for User Story 1

- [X] T007 [P] [US1] Write failing tests for `createApiKey` in `src/bcs/identity-access/application/create-api-key.test.ts` (Testcontainers; spy on `@/bcs/audit-compliance`'s `record` via the barrel-spy pattern per `CLAUDE.md`): an admin can create a key with any well-formed scope (e.g. `"prompts:write"`), returning `{ id, rawKey }` where `rawKey` starts with `"sk_"`; a member can create a key with only `:read` scopes; a member requesting a `:write` or `:run` scope throws `ScopeExceedsPermissionsError`; creating with an empty `scopes` array throws `NoScopesSelectedError`; creating with a malformed scope string (e.g. `"bad"`, `"Prompts:READ"`, `"prompts:delete"`) throws `InvalidScopeError`; the stored row's `key_hash` equals the SHA-256 hex digest of the returned `rawKey`, and `prefix` equals `rawKey.slice(0, 12)`; querying the `api_keys` row directly confirms no column contains `rawKey` in any form (FR-004/SC-003); omitting `expiresAt` stores `null`; providing `expiresAt` stores exactly that value; exactly one audit event (`api_key.created`) is recorded on success; **`vi.spyOn` every `shared/logging` `logger` method (`info`/`warn`/`error`/`debug`) around a successful `createApiKey` call and assert none was ever called with an argument containing the returned `rawKey` substring (FR-011, constitution Principle V/tenet S3 — the exact class of bug this backlog item's Technical Notes name from the legacy `mcp/tools.py`)** (depends on Foundational: T001, T005)

### Implementation for User Story 1

- [X] T008 [US1] Implement `createApiKey(db, actingUser, params)` in `src/bcs/identity-access/application/create-api-key.ts`: validate `scopes` non-empty (`NoScopesSelectedError`), validate each scope's shape (`InvalidScopeError`), validate each scope against `isScopeAllowedForRole(scope, actingUser.role)` (`ScopeExceedsPermissionsError`), generate the raw key + SHA-256 hash + prefix (research.md §3), insert + audit via `withAudit` (action `api_key.created`), return `{ id, rawKey }` (depends on T007) — makes T007 pass
- [X] T009 [US1] Export `createApiKey` and the `ApiKey`/`ApiKeySummary` types from `src/bcs/identity-access/index.ts` (depends on T008)

**Checkpoint**: US1 independently functional — keys can be created, scope-validated, and permission-capped correctly.

---

## Phase 3: User Story 2 - Authenticate a request using an API key (Priority: P1)

**Goal**: A raw key value correctly resolves to its owning user, organization, and scopes; any unrecognized, expired, revoked, or owner-deactivated key resolves to "not authenticated" without throwing.

**Independent Test**: Insert a key fixture directly via `api-keys-repo` (bypassing `createApiKey`, matching `accept-invitation.test.ts`'s precedent of exercising a lower-level fixture directly), call `authenticateApiKey(db, rawKey)`, and confirm it resolves the correct user/org/scopes; confirm a garbage string, an expired key, a revoked key, and a key whose owner is deactivated all resolve to `null`.

### Tests for User Story 2

- [X] T010 [P] [US2] Write failing tests for `authenticateApiKey` in `src/bcs/identity-access/application/authenticate-api-key.test.ts` (Testcontainers; fixtures inserted directly via `api-keys-repo`/`users-repo`): a valid, active, unexpired key resolves the correct `UserSummary` and `scopes`; an unrecognized/malformed string returns `null` without throwing; a revoked key (`is_active: false`) returns `null`; an expired key (`expires_at` in the past) returns `null` even when `is_active` is still `true`; a key whose owning user has been deactivated returns `null` (research.md §4); a successful authentication updates `last_used_at`; a failed attempt (any of the rejection cases above) does not change `last_used_at`; **a key created by an admin with a `:write` scope, whose owner is subsequently downgraded to `"member"` via `updateUser`, still authenticates and still returns the original `:write` scope unchanged — the permission cap (FR-003) is enforced only at creation time, not re-checked on every authentication (spec.md Edge Cases, research.md §2)** (depends on Foundational: T001, T005)

### Implementation for User Story 2

- [X] T011 [US2] Implement `authenticateApiKey(db, rawKey)` in `src/bcs/identity-access/application/authenticate-api-key.ts`: hash `rawKey`, look up by hash, return `null` for no match, inactive, expired, or missing/inactive owning user; otherwise update `last_used_at` and return `{ user, scopes }` (depends on T010) — makes T010 pass
- [X] T012 [US2] Export `authenticateApiKey` from `src/bcs/identity-access/index.ts` (depends on T011)

**Checkpoint**: US2 independently functional — authentication resolves correctly and never throws.

---

## Phase 4: User Story 3 - Revoke a key (Priority: P2)

**Goal**: A key's owner, or an org admin acting on a user in their own organization, can immediately and permanently deactivate a key.

**Independent Test**: Insert a key fixture, call `revokeApiKey(db, actingUser, keyId)`, and confirm a subsequent `authenticateApiKey` call with its raw value returns `null`.

### Tests for User Story 3

- [X] T013 [P] [US3] Write failing tests for `revokeApiKey` in `src/bcs/identity-access/application/revoke-api-key.test.ts` (Testcontainers; spy on `record` via the audit-compliance barrel): a key's owner can revoke their own key, after which `authenticateApiKey` on its raw value returns `null`; an org admin can revoke a key belonging to a different user in the same organization; a caller who is neither the owner nor an admin of the owner's organization throws `NotAuthorizedError`; revoking an already-revoked key is a no-op (resolves without error, writes no additional audit event); revoking a nonexistent/wrong-organization id throws `ApiKeyNotFoundError`; exactly one audit event (`api_key.revoked`) is recorded for the real revoke (depends on Foundational: T001, T005)

### Implementation for User Story 3

- [X] T014 [US3] Implement `revokeApiKey(db, actingUser, keyId)` in `src/bcs/identity-access/application/revoke-api-key.ts`: look up the key scoped to `actingUser.orgId` (else `ApiKeyNotFoundError`), authorize self-or-admin (`actingUser.id === key.userId || actingUser.role === "admin"`, else `NotAuthorizedError`), no-op if already inactive, otherwise `markRevoked` + audit via `withAudit` (action `api_key.revoked`) (depends on T013) — makes T013 pass
- [X] T015 [US3] Export `revokeApiKey` from `src/bcs/identity-access/index.ts` (depends on T014)

**Checkpoint**: US3 independently functional.

---

## Phase 5: User Story 4 - Review issued keys (Priority: P3)

**Goal**: A user can list their own keys; an org admin can list keys belonging to any user in their own organization. Never exposes the raw value or its hash.

**Independent Test**: Create two keys for one user with different scopes, call `listApiKeys(db, user)`, and confirm both appear with the expected fields and no raw value/hash; confirm an admin can list another same-organization user's keys, a non-admin cannot list someone else's, and a different organization's keys never appear.

### Tests for User Story 4

- [X] T016 [P] [US4] Write failing tests for `listApiKeys` in `src/bcs/identity-access/application/list-api-keys.test.ts` (Testcontainers): a user listing with no `targetUserId` sees only their own keys, newest first, with no `keyHash`/raw value in the result; an org admin listing another user's keys (`targetUserId` set) in the same organization succeeds; a non-admin caller attempting to list someone else's keys throws `NotAuthorizedError`; an admin passing a `targetUserId` belonging to a different organization throws `CrossOrgUserAccessError`; keys belonging to a different organization never appear in any result (depends on Foundational: T001, T005)

### Implementation for User Story 4

- [X] T017 [US4] Implement `listApiKeys(db, actingUser, targetUserId?)` in `src/bcs/identity-access/application/list-api-keys.ts`: resolve the target user (default `actingUser.id`); if it differs from `actingUser.id`, require `actingUser.role === "admin"` (else `NotAuthorizedError`) and confirm the target exists in `actingUser.orgId` via `users-repo.findByOrgAndId` (else `CrossOrgUserAccessError`); query `listByOrgAndUser`; map rows to `ApiKeySummary` (depends on T016) — makes T016 pass
- [X] T018 [US4] Export `listApiKeys` from `src/bcs/identity-access/index.ts` (depends on T017)

**Checkpoint**: All four user stories independently functional and tested.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] Run `pnpm typecheck` and fix any type errors
- [X] T020 [P] Run `pnpm lint` (including `eslint-plugin-boundaries`) and fix any violations
- [X] T021 Run `pnpm test` and confirm every test under `src/bcs/identity-access/` passes
- [X] T022 Execute `quickstart.md`'s scenarios (adapted to the test suite, since no route/REPL access is assumed in CI) and confirm its listed expected outcomes match reality
- [X] T023 Update `bcs/identity-access/CONTRACT.md`'s Exposed APIs table: fill in real signatures for the already-listed `authenticateApiKey`/`createApiKey`/`revokeApiKey` forward-looking entries, and add a `listApiKeys` row (depends on T009, T012, T015, T018)
- [X] T024 Update `backlog/002-identity-access/006-api-keys.md`: check off every Requirements/Acceptance Criteria bullet actually delivered; add a Technical Notes entry documenting the `/speckit-clarify`-driven scope-shape (structural, not closed-enum) and permission-cap (role-based) design (depends on T021, T022)
- [X] T025 Move `backlog/002-identity-access/006-api-keys.md` to `backlog/002-identity-access/archive/006-api-keys.md`, set `status: done`; update `backlog/002-identity-access/EPIC.md`'s Features list link for item 006 to point at `archive/006-api-keys.md` and check it off (depends on T024)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies. Blocks every user story.
- **User Stories (Phase 2-5)**: All depend on Foundational only, not on each other at the production-code level — each function calls Foundational primitives (the repo, domain types) directly, and each story's tests set up their own fixtures directly via the repo rather than chaining through another story's function. They can be built in any order or in parallel.
- **Polish (Phase 6)**: Depends on all four user stories being complete.

### Parallel Opportunities

- T001 and T002 can run in parallel (different files); T003 depends on T002.
- T004 depends on T003; T005 depends on T004; T006 depends on T003 and can run in parallel with T004/T005 (different files).
- T007 (US1), T010 (US2), T013 (US3), T016 (US4) — all four story test files depend only on Foundational and can be written in parallel.
- T019, T020 (Polish) can run in parallel.

## Parallel Example: Foundational work

```bash
# Launch together:
Task: "Add ApiKey domain types, scope-shape/permission-cap functions, and error classes in src/bcs/identity-access/domain/api-key.ts"
Task: "Add the api_keys table to src/bcs/identity-access/infrastructure/schema.ts"
```

## Parallel Example: All four stories' test-writing, once Foundational is done

```bash
Task: "Write failing tests for createApiKey in src/bcs/identity-access/application/create-api-key.test.ts"
Task: "Write failing tests for authenticateApiKey in src/bcs/identity-access/application/authenticate-api-key.test.ts"
Task: "Write failing tests for revokeApiKey in src/bcs/identity-access/application/revoke-api-key.test.ts"
Task: "Write failing tests for listApiKeys in src/bcs/identity-access/application/list-api-keys.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Foundational) — this alone delivers a tested `api_keys` table, migration, and race-free repo, independently valuable.
2. Complete Phase 2 (US1) — key creation is the entry point every other story needs a real row to act on, even though US2/US3/US4 don't strictly require US1's code to function (their tests insert fixtures directly).

### Incremental Delivery

1. Foundational → `api_keys` table/migration, domain types, repo, all tested in isolation.
2. US1 → keys can be created, scope-validated, permission-capped.
3. US2 → authentication resolves correctly end-to-end, never throws.
4. US3 → revocation works, audit-logged, idempotent.
5. US4 → listing works, self-or-admin scoped, never exposes secret material.
6. Polish → typecheck/lint/full test suite/quickstart validation, `CONTRACT.md` updated, `006-api-keys` backlog item updated and archived.
