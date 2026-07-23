---

description: "Task list for feature implementation"
---

# Tasks: JWT Session Auth

**Input**: Design documents from `/specs/008-jwt-session-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/identity-access-auth.md, contracts/audit-compliance-record.md, quickstart.md

**Tests**: Included and REQUIRED — constitution Principle I (Test-First Development) mandates a failing test before any new backend logic in this repo.

**Organization**: Tasks are grouped by user story (spec.md's US1/US2/US3/US4, priority order) so each can be implemented and verified independently. Two bounded contexts are touched (`identity-access`, `audit-compliance`) because this feature's `/speckit-clarify` session pulled `003-audit-compliance/001`'s schema/write-path forward — see plan.md's Complexity Tracking.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same batch (different files, no dependency on each other)
- **[Story]**: Maps the task to spec.md's US1/US2/US3/US4
- File paths are exact, relative to repo root

## Phase 1: Setup

- [ ] T001 Add `jose` as a dependency (`pnpm add jose`) — research.md §1
- [ ] T002 [P] Add `JWT_SECRET` and `JWT_EXPIRY_HOURS` to `.env.example`, placeholder-style (`JWT_SECRET=REPLACE_ME_JWT_SECRET`, `JWT_EXPIRY_HOURS=24`), matching `DATABASE_URL`'s existing `REPLACE_ME` convention

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The fail-closed `JWT_SECRET` validator, the pulled-forward `audit.audit_events` table + `record()` write path, and JWT sign/verify — every user story needs at least one of these (all four write audit events; US1/US2/US4 need JWT sign/verify; US4 needs the secret validator specifically).

- [ ] T003 [P] Write failing tests for `getJwtSecret` in `src/shared/config/index.test.ts`: throws when missing; throws when equal to the documented placeholder; returns the real value otherwise — mirrors `src/shared/db/client.test.ts`'s `getConnectionString` tests exactly (research.md §2)
- [ ] T004 [P] Implement `getJwtSecret(env?)` in `src/shared/config/index.ts` (depends on T003) — makes T003 pass
- [ ] T005 [P] Add `AuditEvent` domain type and the redaction key list (`password_hash`, `key_hash`, raw-token-shaped fields) in `src/bcs/audit-compliance/domain/audit-event.ts` (data-model.md)
- [ ] T006 [P] Add the `audit_events` table to `src/bcs/audit-compliance/infrastructure/schema.ts`: `id`, `organization_id` (nullable, FK → `identity_access.organizations.id`), `actor_user_id` (nullable), `actor_api_key_id` (nullable), `action`, `resource_type`, `resource_id` (nullable), `before`/`after` (jsonb, nullable), `created_at`; index on `(organization_id, created_at)` (data-model.md)
- [ ] T007 Generate and review the migration: `MIGRATION_DATABASE_URL=... pnpm db:generate`, rename to `drizzle/migrations/000N_audit_audit_events.sql` and update `_journal.json`'s `tag`; confirm the nullable `organization_id` FK and the composite index are present (depends on T006)
- [ ] T008 [P] Write failing tests for `audit-events-repo.insert` in `src/bcs/audit-compliance/infrastructure/audit-events-repo.test.ts` (Testcontainers, `startTestDb()`): inserts one row with all fields set; inserts one row with `organizationId`/`resourceId` both `null` (unknown-email case) (depends on T007)
- [ ] T009 Implement `audit-events-repo.ts` (`insert(tx, row)`) in `src/bcs/audit-compliance/infrastructure/audit-events-repo.ts` (depends on T008) — makes T008 pass
- [ ] T010 [P] Write failing tests for `record()` in `src/bcs/audit-compliance/application/record.test.ts` (Testcontainers): inserts exactly one row matching the given event; a `password_hash`/`key_hash`/raw-token field nested anywhere inside `before`/`after` is stripped before storage, verified by reading the row back (depends on T005, T007)
- [ ] T011 Implement `record(tx, event)` in `src/bcs/audit-compliance/application/record.ts`: applies redaction, calls `audit-events-repo.insert` (depends on T009, T010) — makes T010 pass
- [ ] T012 Export `record` and the `AuditEvent`/`NewAuditEvent` types from `src/bcs/audit-compliance/index.ts` (depends on T011)
- [ ] T013 [P] Write failing tests for JWT sign/verify in `src/bcs/identity-access/infrastructure/jwt.test.ts`: `signSessionJwt` produces a token `verifySessionJwt` accepts, returning `{ sub, role }`; an expired token is rejected; a tampered/wrong-signature token is rejected; both functions throw (via `getJwtSecret`) when `JWT_SECRET` is missing or placeholder, before attempting to sign/verify anything (depends on T004)
- [ ] T014 Implement `signSessionJwt(claims)` / `verifySessionJwt(token)` in `src/bcs/identity-access/infrastructure/jwt.ts` using `jose`'s `SignJWT`/`jwtVerify`, HS256, reading `getJwtSecret()` and `JWT_EXPIRY_HOURS` (default 24) (depends on T001, T013) — makes T013 pass
- [ ] T015 [P] Add `SessionClaims` and `SessionCookieDescriptor` types in `src/bcs/identity-access/domain/session.ts`, plus the session-cookie name constant (data-model.md)

**Checkpoint**: `JWT_SECRET` validator, audit write path, and JWT sign/verify are all in place and tested. Every user story below can now proceed.

---

## Phase 3: User Story 1 - Log in with email and password (Priority: P1) 🎯 MVP

**Goal**: A registered, active user can log in with correct credentials and receive a session; wrong password, unknown email, and deactivated accounts are all rejected identically; every attempt (success or failure) is audit-logged.

**Independent Test**: Call `login(db, email, password)` with valid credentials and confirm a non-null result with a usable cookie descriptor; call it with a wrong password, an unknown email, and a deactivated user's credentials and confirm all three return `null`.

### Tests for User Story 1

- [ ] T016 [P] [US1] Write failing tests for `login` in `src/bcs/identity-access/application/login.test.ts` (Testcontainers): correct credentials → non-null `{ user, cookie }`, `cookie.httpOnly === true`, `cookie.secure`/`cookie.sameSite` match the descriptor's typed values (FR-004); wrong password → `null`; unknown email → `null`, response shape identical to wrong-password case; deactivated user with correct password → `null`; a successful login writes one `audit_events` row (`action: "user.login"`, `actorUserId` set); a failed login against a real account writes one row (`action: "user.login_failed"`, `actorUserId` set); a failed login against an unknown email writes one row (`action: "user.login_failed"`, `actorUserId`/`organizationId` both `null`); the submitted password never appears in any written row; if `record()` is made to throw (e.g. by stubbing it), `login()` throws too — for both the success path and a would-be-failure path — rather than returning a cookie or `null` (FR-013, mirrors T022's equivalent logout case) (depends on Foundational: T009, T011, T014, T015)

### Implementation for User Story 1

- [ ] T017 [US1] Implement `login(db, email, password)` in `src/bcs/identity-access/application/login.ts`: lowercase-normalized email lookup (matching `007-user-accounts-registration`'s stored-lowercase convention), `bcryptjs.compare` against `password_hash`, reject inactive users; on any outcome, open `db.transaction()` and call `record()` before returning (research.md §7) so an audit-write failure throws rather than reporting success; sign the JWT and build the `SessionCookieDescriptor` (`secure: NODE_ENV === "production"`) only on the success path (depends on T016) — makes T016 pass
- [ ] T018 [US1] Export `login` from `src/bcs/identity-access/index.ts` (depends on T017)

**Checkpoint**: US1 independently functional — login works end-to-end with audit coverage.

---

## Phase 4: User Story 2 - Stay signed in across requests (Priority: P2)

**Goal**: A valid session cookie resolves to the authenticated user's current identity; an expired, tampered, or missing session resolves to "no user," never an error.

**Independent Test**: Sign a token directly via `signSessionJwt` (or obtain one via `login`), build a `Cookie` header string from it, and confirm `authenticateSession(db, cookieHeader)` resolves to the matching `UserSummary`. Confirm an expired token, a tampered token, and a missing/empty header all resolve to `null`.

### Tests for User Story 2

- [ ] T019 [P] [US2] Write failing tests for `authenticateSession` in `src/bcs/identity-access/application/authenticate-session.test.ts` (Testcontainers): a cookie header built from a freshly-signed valid token resolves to the correct `UserSummary`, sourced from the user's *current* row (not the JWT's own claims) — verify by changing the user's `role` after signing and confirming the resolved `UserSummary` reflects the new role; an expired token → `null`; a tampered/wrong-signature token → `null`; `cookieHeader` of `null`/`undefined`/`""` → `null`; a `Cookie` header present but without this feature's session-cookie name → `null` (depends on Foundational: T014, T015; uses `getUser`, already implemented)

### Implementation for User Story 2

- [ ] T020 [US2] Implement `authenticateSession(db, cookieHeader)` in `src/bcs/identity-access/application/authenticate-session.ts`: parse the named cookie out of the raw header, `verifySessionJwt`, on success call `getUser(db, claims.sub)`; catch any verification failure and resolve `null` rather than throwing (depends on T019) — makes T019 pass
- [ ] T021 [US2] Export `authenticateSession` from `src/bcs/identity-access/index.ts` (depends on T020)

**Checkpoint**: US2 independently functional — session resolution is correct and never throws for an expected negative case.

---

## Phase 5: User Story 3 - Log out (Priority: P3)

**Goal**: Logging out produces a cookie-clearing descriptor and writes an audit event; calling it again (or with no real prior session) is a harmless no-op.

**Independent Test**: Call `logout(db, userId)` for a real user and confirm the returned cookie descriptor has an empty value and `maxAge: 0`; call it again and confirm it still succeeds without error.

### Tests for User Story 3

- [ ] T022 [P] [US3] Write failing tests for `logout` in `src/bcs/identity-access/application/logout.test.ts` (Testcontainers): returns `{ cookie }` with `cookie.value === ""` and `cookie.maxAge === 0`; writes exactly one `audit_events` row (`action: "user.logout"`, `actorUserId` set); calling it twice in a row for the same user succeeds both times (idempotent — no server-side session state to check); if `record()` is made to throw (e.g. by stubbing it), `logout` throws too and returns no cookie (depends on Foundational: T009, T011, T015)

### Implementation for User Story 3

- [ ] T023 [US3] Implement `logout(db, userId)` in `src/bcs/identity-access/application/logout.ts`: `db.transaction()` wrapping a `record()` call (`action: "user.logout"`), then returns the clearing `SessionCookieDescriptor` (depends on T022) — makes T022 pass
- [ ] T024 [US3] Export `logout` from `src/bcs/identity-access/index.ts` (depends on T023)

**Checkpoint**: US3 independently functional.

---

## Phase 6: User Story 4 - Operator is protected from an insecure default signing secret (Priority: P2)

**Goal**: Confirm end-to-end (not just at the `jwt.ts`/`getJwtSecret` unit level already covered in Foundational) that a missing or placeholder `JWT_SECRET` blocks real work — a login attempt — rather than silently succeeding with an insecure key.

**Independent Test**: With `JWT_SECRET` stubbed to missing/placeholder, call `login()` with otherwise-valid credentials and confirm it throws before returning anything; with a real secret, confirm it succeeds normally.

### Tests for User Story 4

- [ ] T025 [P] [US4] Write failing tests in `src/bcs/identity-access/application/login.test.ts` (extend the file from T016): with `JWT_SECRET` env-stubbed to missing, `login()` with correct credentials throws (not `null`, not a resolved cookie); same with `JWT_SECRET` stubbed to the documented placeholder; with a real secret restored, the same call succeeds (depends on T017, T004)

### Implementation for User Story 4

- [ ] T026 [US4] No new production code expected — T013/T014 (Foundational) and T017 (`login`) already call `getJwtSecret()`/`signSessionJwt` unconditionally on the success path. Run T025; if it reveals a gap (e.g. `login` catching and swallowing the `getJwtSecret` throw), fix `login.ts` so the error propagates uncaught (depends on T025)

**Checkpoint**: All four user stories independently functional and tested; fail-closed secret behavior verified at both the unit (Foundational) and feature (US1 login path) level.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T027 [P] Run `pnpm typecheck` and fix any type errors
- [ ] T028 [P] Run `pnpm lint` (including `eslint-plugin-boundaries`) and fix any violations
- [ ] T029 Run `pnpm test` and confirm every test under `src/bcs/identity-access/`, `src/bcs/audit-compliance/`, and `src/shared/config/` passes
- [ ] T030 Execute `quickstart.md`'s scenarios (adapted to the test suite, since no route/REPL access is assumed in CI) and confirm its listed expected outcomes match reality
- [ ] T031 Update `bcs/identity-access/CONTRACT.md`: add `login(db, email, password)` and `logout(db, userId)` rows to the Exposed APIs table; correct the existing `authenticateSession(request)` row to `authenticateSession(db, cookieHeader)` per contracts/identity-access-auth.md's note (depends on T018, T021, T024)
- [ ] T032 Update `bcs/audit-compliance/CONTRACT.md` if its existing `record(event)` row needs adjustment to match the concrete `record(tx, event)` signature actually implemented; confirm the `AuditEvent` Data Contracts shape matches `data-model.md` exactly (depends on T012)
- [ ] T033 Update `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`: check off the `audit.audit_events` table, `record()` function, redaction, and index Requirements bullets (all completed by T005–T012); leave the "retrofit epic 002's mutations" bullet and `status: open` as-is (not archived — that requirement is explicitly still unmet, per plan.md's Complexity Tracking); add a note under Technical Notes that the schema/write-path portion was pulled forward and completed by `008-jwt-session-auth` (2026-07-23), and that `audit.audit_events` currently has no RLS policy (new, explicitly tracked gap — no existing backlog item owns audit-schema RLS)
- [ ] T034 Update `backlog/002-identity-access/004-jwt-session-auth.md`'s own `dependencies` frontmatter and Dependencies section to add `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md` (per spec.md's Assumptions, this was flagged as needing to happen); resolve the Open Questions bullet (refresh-flow timing) by noting it's answered in `context/auth-conventions.md`/this feature's own spec.md Assumptions — no refresh flow at launch
- [ ] T035 Move `backlog/002-identity-access/004-jwt-session-auth.md` to `backlog/002-identity-access/archive/004-jwt-session-auth.md`, set `status: done`, check off every Requirement and Acceptance Criteria bullet that's actually met: login verification/JWT issuance/cookie-building are delivered as `login()`, an application-layer function (matching `003-user-accounts-and-registration`'s identical precedent for its own "registration route" bullet) — not a literal HTTP route, which stays owned by `007-distribution`; `authenticateSession` and logout are both delivered per contracts.md; the `JWT_SECRET` startup check is delivered as a fail-closed validator (research.md §2); cookie flags match `context/auth-conventions.md` exactly. Update `backlog/002-identity-access/EPIC.md`'s Features list link for item 004 to point at `archive/004-jwt-session-auth.md` and check it off (depends on T034 and all prior phases)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user story.
- **User Stories (Phase 3-6)**: All depend on Foundational only, not on each other — US1 (`login`), US2 (`authenticateSession`), and US3 (`logout`) each call Foundational primitives directly and can be built in any order or in parallel. US4 depends on US1's `login.ts` existing (T017) since its test extends `login.test.ts`, but adds no new production code of its own.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Parallel Opportunities

- T002 (env vars) can run in parallel with T001.
- T003/T005/T006/T013/T015 can all start in parallel once T001 lands (different files); T004 depends on T003, T007 depends on T006, T014 depends on T001+T013.
- T008 depends on T007; T010 depends on T005+T007 — both can then run in parallel with each other and with T013.
- T016 (US1 tests), T019 (US2 tests), T022 (US3 tests) all depend only on Foundational and can be written in parallel across different files.
- T027, T028 (Polish) can run in parallel.

## Parallel Example: Foundational + all three independent stories' test-writing

```bash
# After Foundational (T003-T015) is done, launch together:
Task: "Write failing tests for login in src/bcs/identity-access/application/login.test.ts"
Task: "Write failing tests for authenticateSession in src/bcs/identity-access/application/authenticate-session.test.ts"
Task: "Write failing tests for logout in src/bcs/identity-access/application/logout.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational) — this alone delivers a tested, fail-closed `JWT_SECRET` validator and a working audit write path, both independently valuable.
2. Complete Phase 3 (US1) — login is the entry point every other story depends on for a realistic end-to-end demonstration, even though US2/US3 don't strictly require US1's code to function.

### Incremental Delivery

1. Setup + Foundational → JWT infra, `JWT_SECRET` validation, and audit write path exist and are tested in isolation.
2. US1 → login works end-to-end, audit-logged.
3. US2 → session resolution works for any valid/invalid token, independent of how it was obtained.
4. US3 → logout works, audit-logged, idempotent.
5. US4 → confirms the fail-closed secret behavior holds through the real `login()` path, not just the isolated `jwt.ts` unit.
6. Polish → typecheck/lint/full test suite/quickstart validation, both `CONTRACT.md` files updated, `003-audit-compliance/001` and `002-identity-access/004-jwt-session-auth` backlog items updated/archived appropriately.
