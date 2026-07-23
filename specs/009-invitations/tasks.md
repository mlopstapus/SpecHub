---

description: "Task list for feature implementation"
---

# Tasks: Invitations

**Input**: Design documents from `/specs/009-invitations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/identity-access-invitations.md, quickstart.md

**Tests**: Included and REQUIRED — constitution Principle I (Test-First Development) mandates a failing test before any new backend logic in this repo.

**Organization**: Tasks are grouped by user story (spec.md's US1/US2/US3/US4, priority order) so each can be implemented and verified independently. Two new shared kernel modules (`shared/email`, `shared/logging`) are foundational since every user story's email/log behavior depends on them; the `identity_access.invitations` table and its repo are likewise foundational since every user story reads or writes it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same batch (different files, no dependency on each other)
- **[Story]**: Maps the task to spec.md's US1/US2/US3/US4
- File paths are exact, relative to repo root

## Phase 1: Setup

- [X] T001 Add `nodemailer` and `@types/nodemailer` as dependencies (`pnpm add nodemailer && pnpm add -D @types/nodemailer`) — research.md §4
- [X] T002 [P] Add `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`, `INVITATION_EXPIRY_HOURS`, and `APP_BASE_URL` to `.env.example`, matching the file's existing commented/placeholder style (SMTP vars left blank/commented — unset is the valid, self-host default per FR-005 — `INVITATION_EXPIRY_HOURS=168`, `APP_BASE_URL=http://localhost:3000`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `shared/logging`'s first real logger, the three new `shared/config` getters, `shared/email`'s `sendEmail`, the `invitations` domain types/errors, the `identity_access.invitations` table + migration, and the invitations repo (including the concurrency-critical conditional accept) — every user story needs all of these.

- [X] T003 [P] Write failing tests for `logger` in `src/shared/logging/index.test.ts`: exported `logger` has `.info`/`.warn`/`.error` methods; respects `LOG_LEVEL` env var when set, defaults to `"info"` otherwise (research.md §5)
- [X] T004 Implement `logger` (a `pino` instance) in `src/shared/logging/index.ts` (depends on T003) — makes T003 pass
- [X] T005 [P] Write failing tests for `getInvitationExpiryHours`, `getAppBaseUrl`, and `getSmtpConfig` in `src/shared/config/index.test.ts` (extend the existing file, matching `getJwtExpiryHours`'s existing test style): `getInvitationExpiryHours` defaults to 168, parses a valid override, throws on a non-positive/non-numeric override; `getAppBaseUrl` defaults to `"http://localhost:3000"`, returns an explicit override; `getSmtpConfig` returns `null` when `SMTP_HOST` is unset, returns the full `{ host, port, user, pass, from }` shape when set
- [X] T006 Implement `getInvitationExpiryHours(env?)`, `getAppBaseUrl(env?)`, `getSmtpConfig(env?)` in `src/shared/config/index.ts` (depends on T005) — makes T005 pass
- [X] T007 [P] Write failing tests for `sendEmail` in `src/shared/email/send-email.test.ts` (mocking `nodemailer` via `vi.mock` and stubbing env for `getSmtpConfig`): with no SMTP configured, resolves without throwing and logs the full message via `shared/logging`'s `logger` (verify via `vi.spyOn(logger, "info")`), and does not call `nodemailer.createTransport`; with SMTP configured, calls `createTransport` with the config from `getSmtpConfig` and `sendMail` with `{ to, subject, text }` plus `from`; if the underlying `sendMail` rejects, `sendEmail` rejects too (research.md §4 — errors propagate, callers decide best-effort handling)
- [X] T008 Implement `sendEmail({ to, subject, text })` in `src/shared/email/send-email.ts`, plus `src/shared/email/index.ts` barrel exporting `sendEmail` and the `EmailMessage` type (depends on T001, T004, T006, T007) — makes T007 pass
- [X] T009 [P] Add `Invitation`, `InvitationSummary`, `InvitationRole`, `InvitationState` types, `deriveInvitationState`, and the error classes (`DuplicateInvitationError`, `InvalidInvitationTokenError`, `InvitationExpiredError`, `InvitationAlreadyAcceptedError`, `InvitationRevokedError`, `InvitationNotFoundError`) in `src/bcs/identity-access/domain/invitation.ts` (data-model.md)
- [X] T010 [P] Add the `invitations` table to `src/bcs/identity-access/infrastructure/schema.ts`: `id`, `organization_id` (not null, no FK), `team_id` (FK → `teams.id`), `email`, `role` (enum, default `"member"`), `token` (unique), `invited_by_id` (FK → `users.id`), `accepted_at`/`revoked_at` (nullable), `expires_at` (not null), `created_at`/`updated_at`; add a non-unique index on `(organization_id, email)` (data-model.md)
- [X] T011 Generate and review the migration: `MIGRATION_DATABASE_URL=... pnpm db:generate`, rename to `drizzle/migrations/0005_identity_access_invitations.sql` and update `_journal.json`'s `tag` per `context/database-conventions.md`; confirm the unique `token` constraint, both FKs, and the `(organization_id, email)` index are present (depends on T010)
- [X] T012 [P] Write failing tests for the concurrency-critical conditional accept in `src/bcs/identity-access/infrastructure/invitations-repo.test.ts` (Testcontainers, `startTestDb()`): `markAccepted` on a pending row returns the updated row with `accepted_at` set; calling `markAccepted` again on the same now-accepted row returns `undefined`/no row (the conditional `WHERE accepted_at IS NULL AND revoked_at IS NULL` already excludes it) — this is the low-level guarantee `acceptInvitation`'s race-safety (research.md §6) depends on (depends on T011)
- [X] T013 Implement `invitations-repo.ts` in `src/bcs/identity-access/infrastructure/invitations-repo.ts`: `insert`, `findByToken`, `findById`, `findActivePendingByEmail` (organization + email scoped, excludes accepted/revoked/expired rows), `listByOrganization`, `markAccepted` (conditional update per research.md §6), `markRevoked` (depends on T012) — makes T012 pass
- [X] T014 [P] Add invitations-table constraint assertions to `src/bcs/identity-access/infrastructure/schema.test.ts` (real migration, matching the file's existing `organizations`-table assertion style): unique constraint on `token`; `team_id` and `invited_by_id` foreign keys present; `organization_id` is not-null with no foreign key (matching every other `organization_id` column in this schema) (depends on T011)

**Checkpoint**: Shared email/logging/config infra, invitation domain types, the table/migration, and the repo (including its race-safety guarantee) are all in place and tested. Every user story below can now proceed.

---

## Phase 3: User Story 1 - Invite a teammate by email (Priority: P1) 🎯 MVP

**Goal**: An org admin or the target team's owner can invite an email to a team/role; duplicates and already-registered emails are rejected; email delivery is attempted best-effort and never blocks creation.

**Independent Test**: Call `inviteUser(db, actingUser, { teamId, email, role })` as an admin and as a team owner and confirm both succeed with a unique token; confirm a non-admin/non-owner caller, a duplicate pending invite, and an already-registered email are all rejected with the correct error.

### Tests for User Story 1

- [X] T015 [P] [US1] Write failing tests for `inviteUser` in `src/bcs/identity-access/application/invite-user.test.ts` (Testcontainers; mock `@/shared/email`'s `sendEmail` via `vi.mock`, and spy on `@/bcs/audit-compliance`'s `record` via the barrel-spy pattern per `CLAUDE.md`): an org admin can invite; the target team's owner (role `"member"`) can also invite for their own team; a caller who is neither is rejected with `NotAuthorizedError`; **a `teamId` belonging to a different organization than `actingUser.orgId` is rejected with `InvalidTeamAssignmentError`** (M1/M3 cross-tenant negative test — FR-001); a duplicate active invitation for the same `(org, email)` is rejected with `DuplicateInvitationError`, including when the second attempt targets a *different* team in the same org; an already-active user with that email in the same org is rejected with `DuplicateUserError`; the same email already registered in a *different* org does not block the invite; a prior expired or revoked invitation for the same email does not block a new one; the created invitation's `expires_at` reflects `INVITATION_EXPIRY_HOURS` (default 168h); `inviteUser` still returns a created invitation even when the mocked `sendEmail` rejects (best-effort, FR-005); exactly one audit event (`invitation.created`) is recorded on success (depends on Foundational: T006, T008, T009, T013)

### Implementation for User Story 1

- [X] T016 [US1] Implement `inviteUser(db, actingUser, params)` in `src/bcs/identity-access/application/invite-user.ts`: authorize (admin-or-team-owner, research.md §3), validate team, run the duplicate-invitation and duplicate-user checks (research.md §8), generate the token (research.md §2), insert + audit via `withAudit`, then attempt `sendEmail` best-effort (catch and log any rejection, never rethrow) with a message built from `getAppBaseUrl()` + the token (depends on T015) — makes T015 pass
- [X] T017 [US1] Export `inviteUser` and the `Invitation`/`InvitationSummary`/`InvitationRole`/`InvitationState` types from `src/bcs/identity-access/index.ts` (depends on T016)

**Checkpoint**: US1 independently functional — invitations can be created, deduplicated, and authorized correctly.

---

## Phase 4: User Story 2 - Accept an invitation and join the organization (Priority: P1)

**Goal**: A valid, pending, unexpired invitation token can be redeemed exactly once into a new account scoped solely to the invitation's own organization/team/role.

**Independent Test**: Insert an invitation row directly via `invitations-repo.insert` (bypassing `inviteUser`, matching `authenticate-session.test.ts`'s precedent of exercising a lower-level fixture directly), then call `acceptInvitation(db, token, { username, password })` and confirm a correctly-scoped user is created and the same token is rejected on a second attempt.

### Tests for User Story 2

- [X] T018 [P] [US2] Write failing tests for `acceptInvitation` in `src/bcs/identity-access/application/accept-invitation.test.ts` (Testcontainers, fixtures inserted directly via `invitations-repo`): a valid pending token creates a user scoped to exactly the invitation's `organizationId`/`teamId`/`role`, marks the invitation accepted, and returns its `UserSummary`; **an explicit two-organization negative test (M3): create org A and org B, accept an invitation belonging to org A, and assert the resulting user's `orgId` equals org A's id and can never equal org B's — the cross-organization-redemption-is-impossible guarantee (FR-007/SC-003), named as its own scenario rather than left implicit in the first assertion**; accepting the same token again throws `InvitationAlreadyAcceptedError`; an expired token throws `InvitationExpiredError`; a revoked token throws `InvitationRevokedError`; an unknown token throws `InvalidInvitationTokenError`; a username collision within the invitation's organization throws `DuplicateUserError` **without** consuming the token — a retry with a different username on the same token succeeds; a password under 8 characters throws `WeakPasswordError`; (an explicit "invitation's team was deleted" scenario was dropped — discovered during implementation that `invitations.team_id`'s FK makes this structurally impossible to construct, since Postgres refuses to delete a team any invitation still references; documented in data-model.md's Relationships section and spec.md's Edge Cases instead of tested); two concurrent `acceptInvitation` calls on the same valid token resolve with exactly one fulfilled and one rejected (`Promise.allSettled`, research.md §6); exactly one audit event (`invitation.accepted`) is recorded on the successful path (depends on Foundational: T006, T009, T013)

### Implementation for User Story 2

- [X] T019 [US2] Implement `acceptInvitation(db, token, params)` in `src/bcs/identity-access/application/accept-invitation.ts`: look up by token, derive state and throw the matching error for non-pending states, then in one transaction (`withAudit`) run the conditional `markAccepted` (research.md §6) followed by `insertValidatedUser` using the invitation's own `organizationId`/`teamId`/`role` (never a caller-supplied value, FR-007) and defaulting `displayName` to `username` when omitted (matching `createUser`'s existing convention), then record the audit event; if the conditional update returns no row (lost the race), throw `InvitationAlreadyAcceptedError`/`InvitationRevokedError` matching the now-current state (depends on T018) — makes T018 pass
- [X] T020 [US2] Export `acceptInvitation` from `src/bcs/identity-access/index.ts` (depends on T019)

**Checkpoint**: US2 independently functional — acceptance is correct, race-safe, and cross-organization-proof.

---

## Phase 5: User Story 3 - Revoke a pending invitation (Priority: P3)

**Goal**: An org admin or the target team's owner can cancel a pending invitation; an already-accepted invitation cannot be revoked; revoking twice is idempotent.

**Independent Test**: Insert a pending invitation fixture, call `revokeInvitation(db, actingUser, invitationId)`, and confirm a subsequent `acceptInvitation` call on its token throws `InvitationRevokedError`.

### Tests for User Story 3

- [X] T021 [P] [US3] Write failing tests for `revokeInvitation` in `src/bcs/identity-access/application/revoke-invitation.test.ts` (Testcontainers; spy on `record` via the audit-compliance barrel): an org admin can revoke a pending invitation, after which `acceptInvitation` on its token throws `InvitationRevokedError`; the target team's owner (non-admin) can also revoke; a caller who is neither is rejected with `NotAuthorizedError`; revoking an already-accepted invitation throws `InvitationAlreadyAcceptedError` and does not alter the resulting user account; revoking an already-revoked invitation is a no-op (resolves without error, writes no additional audit event); revoking a nonexistent/wrong-organization id throws `InvitationNotFoundError`; exactly one audit event (`invitation.revoked`) is recorded for the real revoke (depends on Foundational: T009, T013)

### Implementation for User Story 3

- [X] T022 [US3] Implement `revokeInvitation(db, actingUser, invitationId)` in `src/bcs/identity-access/application/revoke-invitation.ts`: look up the invitation scoped to `actingUser.orgId` (else `InvitationNotFoundError`), authorize (admin-or-team-owner against the invitation's `teamId`, research.md §3), throw `InvitationAlreadyAcceptedError` if already accepted, no-op if already revoked, otherwise `markRevoked` + audit via `withAudit` (depends on T021) — makes T021 pass
- [X] T023 [US3] Export `revokeInvitation` from `src/bcs/identity-access/index.ts` (depends on T022)

**Checkpoint**: US3 independently functional.

---

## Phase 6: User Story 4 - View outstanding invitations (Priority: P3)

**Goal**: An org admin can list their organization's invitations with each one's correct, distinct lifecycle state.

**Independent Test**: Insert one invitation fixture in each of the four states (pending, accepted, expired, revoked) plus one in a different organization, call `listInvitations(db, adminUser)`, and confirm exactly the four same-organization invitations are returned with correct states.

### Tests for User Story 4

- [X] T024 [P] [US4] Write failing tests for `listInvitations` in `src/bcs/identity-access/application/list-invitations.test.ts` (Testcontainers): returns only the caller's organization's invitations, excluding another organization's; each of the four derived states (pending/accepted/expired/revoked) is represented correctly for fixtures set up to produce them; returned shape has no `token` field; a non-admin caller throws `NotAuthorizedError` (depends on Foundational: T009, T013)

### Implementation for User Story 4

- [X] T025 [US4] Implement `listInvitations(db, actingUser)` in `src/bcs/identity-access/application/list-invitations.ts`: authorize admin-only, list by `actingUser.orgId`, map each row through `deriveInvitationState` into `InvitationSummary` (depends on T024) — makes T024 pass
- [X] T026 [US4] Export `listInvitations` from `src/bcs/identity-access/index.ts` (depends on T025)

**Checkpoint**: All four user stories independently functional and tested.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T027 [P] Run `pnpm typecheck` and fix any type errors
- [X] T028 [P] Run `pnpm lint` (including `eslint-plugin-boundaries`) and fix any violations
- [X] T029 Run `pnpm test` and confirm every test under `src/bcs/identity-access/`, `src/shared/email/`, `src/shared/logging/`, and `src/shared/config/` passes
- [X] T030 Execute `quickstart.md`'s scenarios (adapted to the test suite, since no route/REPL access is assumed in CI) and confirm its listed expected outcomes match reality, including the SC-004 self-hosted/no-SMTP walkthrough
- [X] T031 Update `bcs/identity-access/CONTRACT.md`'s Exposed APIs table: replace the forward-looking `inviteUser`/`acceptInvitation` entry with the concrete signatures from `contracts/identity-access-invitations.md`, and add `revokeInvitation`/`listInvitations` rows (depends on T017, T020, T023, T026)
- [X] T032 Append an "Implementation status" section to `context/third-party-services.md`: SMTP self-host path implemented by this feature (`shared/email`); SES managed-SaaS path remains unimplemented, tracked for whenever real SaaS/AWS deployment work begins (plan.md's Complexity Tracking)
- [X] T033 Update `backlog/002-identity-access/005-invitations.md`: check off every Requirements/Acceptance Criteria bullet actually delivered; resolve the Open Questions bullet by noting it was already answered by `context/third-party-services.md` (log-fallback, no hard SMTP requirement) before this feature began; add a Technical Notes entry documenting the `/speckit-clarify`-driven admin-or-team-owner authorization model and the new `revoked_at`/derived-state design (depends on T029, T030)
- [X] T034 Move `backlog/002-identity-access/005-invitations.md` to `backlog/002-identity-access/archive/005-invitations.md`, set `status: done`; update `backlog/002-identity-access/EPIC.md`'s Features list link for item 005 to point at `archive/005-invitations.md` and check it off (depends on T033)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user story.
- **User Stories (Phase 3-6)**: All depend on Foundational only, not on each other at the production-code level — `inviteUser`, `acceptInvitation`, `revokeInvitation`, and `listInvitations` each call Foundational primitives (the repo, domain types) directly, and their tests each set up their own fixtures directly via the repo rather than chaining through another story's function. They can be built in any order or in parallel.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Parallel Opportunities

- T001 and T002 can run in parallel.
- T003/T005/T007/T009/T010 can all start in parallel once Setup lands (different files); T004 depends on T003, T006 depends on T005, T008 depends on T001+T004+T006+T007, T011 depends on T010.
- T012 depends on T011; T013 depends on T012; T014 depends on T011 and can run in parallel with T012/T013 (different files).
- T015 (US1), T018 (US2), T021 (US3), T024 (US4) — all four story test files depend only on Foundational and can be written in parallel.
- T027, T028 (Polish) can run in parallel.

## Parallel Example: Foundational shared-kernel work

```bash
# After Setup (T001-T002) is done, launch together:
Task: "Write failing tests for logger in src/shared/logging/index.test.ts"
Task: "Write failing tests for the three new shared/config getters in src/shared/config/index.test.ts"
Task: "Add Invitation domain types and error classes in src/bcs/identity-access/domain/invitation.ts"
Task: "Add the invitations table to src/bcs/identity-access/infrastructure/schema.ts"
```

## Parallel Example: All four stories' test-writing, once Foundational is done

```bash
Task: "Write failing tests for inviteUser in src/bcs/identity-access/application/invite-user.test.ts"
Task: "Write failing tests for acceptInvitation in src/bcs/identity-access/application/accept-invitation.test.ts"
Task: "Write failing tests for revokeInvitation in src/bcs/identity-access/application/revoke-invitation.test.ts"
Task: "Write failing tests for listInvitations in src/bcs/identity-access/application/list-invitations.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational) — this alone delivers a tested email/logging/config kernel plus the invitations table and race-safe repo, all independently valuable.
2. Complete Phase 3 (US1) — invitation creation is the entry point every other story needs a real row to act on, even though US2/US3/US4 don't strictly require US1's code to function (their tests insert fixtures directly).

### Incremental Delivery

1. Setup + Foundational → email/logging/config kernel, invitations table/migration, race-safe repo, all tested in isolation.
2. US1 → invitations can be created, deduplicated, authorized, and (best-effort) emailed.
3. US2 → acceptance works end-to-end, race-safe, cross-org-proof.
4. US3 → revocation works, audit-logged, idempotent.
5. US4 → listing works, org-scoped, all four states correctly represented.
6. Polish → typecheck/lint/full test suite/quickstart validation, `CONTRACT.md` updated, `third-party-services.md` implementation-status note added, `005-invitations` backlog item updated and archived.
