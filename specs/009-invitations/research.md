# Research: Invitations

## 1. Invitation state is derived, not stored as its own column

**Decision**: The `invitations` table stores `accepted_at` (nullable), `revoked_at` (nullable, new — not present in the legacy Python schema), and `expires_at` (not null). A pure function, `deriveInvitationState(invitation, now)`, computes one of `"pending" | "accepted" | "expired" | "revoked"` from those three columns: `revoked_at` set → `"revoked"`; else `accepted_at` set → `"accepted"`; else `expires_at <= now` → `"expired"`; else `"pending"`.

**Rationale**: An invitation's lifecycle is fully determined by which timestamp(s) are set and how they compare to "now" — storing a redundant enum column risks it drifting out of sync with the timestamps that are the actual source of truth (e.g. an invitation whose `expires_at` has passed but whose stored `state` column was never updated). This mirrors the legacy Python service's own approach (`accepted_at`/`expires_at` compared in application code, no stored state column) and extends it by one column (`revoked_at`) for the new revoke capability from `/speckit-clarify`.

**Alternatives considered**:
- A stored `state` enum column, updated by every mutation — rejected: introduces a second source of truth for "is this expired," which a scheduled cleanup job or clock skew could silently desync from `expires_at`. Every list/read call already needs "now" to render relative expiry anyway, so deriving costs nothing extra.

## 2. Token generation: `node:crypto`'s `randomBytes`, no new dependency

**Decision**: `randomBytes(32).toString("base64url")` — a built-in Node API, matching the legacy Python service's `secrets.token_urlsafe(48)` in spirit (CSPRNG-sourced, URL-safe encoding) at an equivalent security margin (32 raw bytes = 256 bits of entropy).

**Rationale**: No signing/verification is needed here (unlike the JWT case in `008-jwt-session-auth`) — an invitation token is a stored, database-looked-up opaque secret, not a self-contained signed claim. Node's built-in `crypto.randomBytes` plus `base64url` encoding (supported natively since Node 15.7, well within this repo's Node 24 baseline) needs no library at all.

**Alternatives considered**:
- `crypto.randomUUID()` — rejected: only 122 bits of entropy and a fixed, recognizable format; sufficient for primary keys but a weaker, more guessable choice for a bearer credential than 256 bits of raw random bytes.
- A signed/JWT-style token carrying the organization ID as a claim — rejected: FR-007 requires the organization to be resolved from the invitation's own stored record, not decoded from the token itself; an opaque lookup token is simpler and doesn't create a second place (the token's payload) that could theoretically disagree with the database row.

## 3. Authorization: admin-or-team-owner, checked against the target team specifically

**Decision**: `inviteUser`/`revokeInvitation` load the target team via `teams-repo.findById`, verify it belongs to `actingUser.orgId` (else `InvalidTeamAssignmentError`, reusing the existing error from `domain/user.ts`), then require `actingUser.role === "admin" || team.ownerId === actingUser.id` (else `NotAuthorizedError`, also reused). `listInvitations` remains admin-only per this feature's Assumptions (a team owner listing only their own team's invitations is explicitly out of scope, tracked as a future addition the data model already supports).

**Rationale**: Directly implements the `/speckit-clarify` answer. Reusing `InvalidTeamAssignmentError`/`NotAuthorizedError` from `domain/user.ts` (rather than declaring invitation-specific duplicates) keeps one error vocabulary per concern across this bounded context, matching how `create-user.ts`/`insert-validated-user.ts` already reuse these same two classes.

**Alternatives considered**:
- A new `InvitationAuthorizationError` distinct from `NotAuthorizedError` — rejected: no caller needs to distinguish "not authorized to invite" from "not authorized" generically; reusing the existing class avoids an error-class proliferation with no behavioral difference.

## 4. Email sending: new `shared/email` module, SMTP via `nodemailer`; SES explicitly deferred

**Decision**: Add `src/shared/email/send-email.ts` exporting `sendEmail({ to, subject, text }): Promise<void>`. It reads SMTP config (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`) via a new `shared/config` getter, `getSmtpConfig(env?)`, returning `null` when `SMTP_HOST` is unset. If `null`, `sendEmail` logs the full message (via `shared/logging`'s new `logger`) at `info` level and returns — this **is** the self-host log-fallback FR-005 requires, not a stub. If configured, it lazily creates a `nodemailer` SMTP transport and calls `sendMail`. **SES (the managed-SaaS path from `context/third-party-services.md`) is not implemented by this feature** — tracked explicitly in plan.md's Complexity Tracking and a new note appended to `context/third-party-services.md` itself.

**Rationale**: `nodemailer` is the standard, widely-audited Node SMTP client — hand-rolling the SMTP protocol (MIME encoding, TLS negotiation, auth mechanisms) for a "send an email" requirement would be reinventing a well-specified, easy-to-get-subtly-wrong primitive for no benefit, the same reasoning `008-jwt-session-auth`'s research.md §1 already applied to choosing `jose` over hand-rolled JWT signing. SES is deliberately out of scope: this repo has no SaaS/AWS-credentialed environment to build or verify it against yet (no `AWS_REGION`/SES config anywhere in `.env.example` or `context/deployment.md`'s current state), so implementing it now would be unverifiable, speculative infrastructure — worse than an honestly tracked gap, per this repo's own precedent of documenting rather than silently skipping deferred scope (e.g. `008-jwt-session-auth`'s RLS-gap tracking).

**Alternatives considered**:
- Implement SES now too, gated behind an `isSelfHosted()` check — rejected: no way to test it in this environment (no live AWS account, no SES-specific Testcontainers equivalent), and the third-party-services.md decision doc itself frames SES as the *managed SaaS operator's* concern, not something this backend-only feature must stand up speculatively.
- A generic pluggable `EmailProvider` interface with SMTP as the only real implementation today — considered, but rejected as unnecessary abstraction for a single real implementation (this project's own conventions favor no premature abstraction); `sendEmail`'s internal `if (smtp) {...} else {...}` branch is simpler and just as easy to extend with a second real branch later.

## 5. `shared/logging` gets its first real implementation

**Decision**: `src/shared/logging/index.ts` (currently `export {}`) exports `logger`, a `pino` instance (`pino({ level: process.env.LOG_LEVEL ?? "info" })`). `sendEmail`'s log-fallback path is the first real caller.

**Rationale**: `pino` is already a declared dependency (`package.json`) but has never been wired up — this feature is the first to actually need structured logging (the "email skipped, here's the link" line must be discoverable by a self-host operator, which a bare `console.log` would technically satisfy but `context/api-conventions.md`'s general logging-schema expectations point to structured logging as the established direction). Kept deliberately minimal (no pretty-printing transport, no new dependency) — exactly enough for this feature's one real call site, matching how `shared/config` went from an empty barrel to real content only when `008-jwt-session-auth` first needed it.

**Alternatives considered**:
- `console.info` directly in `send-email.ts` — rejected: the whole point of promoting `shared/logging` now is to establish the one real logging call path other future features can extend, rather than each feature reinventing its own ad hoc logging choice.

## 6. Concurrency-safe acceptance via a conditional update

**Decision**: `acceptInvitation` performs the state-changing update as `UPDATE invitations SET accepted_at = now() WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING *` inside the same transaction as the new user's `insertValidatedUser` call (via `withAudit`'s `mutationFn`). If the conditional update returns no row, the invitation was already accepted/revoked concurrently (or between the initial lookup and this call) and `acceptInvitation` throws the appropriate error (`InvitationAlreadyAcceptedError`/`InvitationRevokedError`) rather than proceeding to create a second account.

**Rationale**: Two simultaneous accept requests for the same valid token must not both succeed and create two accounts (or one account plus a confusing partial-failure). A conditional `WHERE accepted_at IS NULL` update is the standard, minimal way to make "mark accepted" a single-winner operation without a separate advisory lock — Postgres's row-level locking within the transaction already serializes concurrent updates to the same row, so the second transaction's conditional update simply matches zero rows once the first commits (or blocks-then-fails-the-condition if it commits first).

**Alternatives considered**:
- A Postgres advisory lock scoped to the token/invitation id (per `CLAUDE.md`'s documented advisory-lock pattern for other mode-conditional/per-scope invariants) — rejected as unnecessary here: advisory locks in this codebase are reserved for invariants that can't be expressed as a simple row-level conditional (e.g. the self-hosted single-organization guard, which has no single row to conditionally update against). A conditional `UPDATE ... WHERE ... RETURNING` is the simpler, sufficient primitive for "exactly one of these concurrent updates may win."

## 7. No REST route or UI built by this feature

**Decision**: This feature stops at the application layer (`src/bcs/identity-access/application/*`, plus the two shared kernel additions). No `src/app/` route handler or page is added, despite `bcs/identity-access/OWNERSHIP.md` listing `/invite/[token]` under this BC's eventual UI ownership.

**Rationale**: Directly matches `007-user-accounts-registration`'s and `008-jwt-session-auth`'s identical, already-twice-established precedent for this same epic — HTTP/UI wiring is owned by `backlog/007-distribution`, which explicitly depends on epic 002 finishing first. `bcs/identity-access/CONTRACT.md` already anticipates this feature's exact function names (`inviteUser`, `acceptInvitation` are listed in its "Exposed APIs" table today, pre-dating this feature's implementation) as functions Distribution's route handlers will call — confirming Distribution is the intended caller, not the implementer, of this feature's own contract surface.

**Alternatives considered**:
- Build a minimal invite/accept route + `/invite/[token]` page now, since `OWNERSHIP.md` names the path explicitly — rejected: would duplicate work `007-distribution` already owns, ahead of that epic's error-mapping conventions being wired into any actual route yet, and breaks the same-epic precedent this epic's prior two features just set.

## 8. Duplicate-invite and duplicate-registered-email checks: organization-scoped, `email`-only

**Decision**: `inviteUser` checks two things before inserting: (1) any *active* invitation (`deriveInvitationState(...) === "pending"`) for the same `(organizationId, email)` — if found, throw `DuplicateInvitationError`; (2) any active `identity_access.users` row for the same `(organizationId, email)` — if found, throw the existing `DuplicateUserError` (reused from `domain/user.ts`). Neither check considers `teamId` — an email already invited to Team A in an organization cannot also be invited to Team B in the same organization while that first invite is still pending.

**Rationale**: Matches this feature's own spec.md Assumptions (organization-scoped, not team-scoped, consistent with `users`/`teams` uniqueness already being organization-scoped elsewhere in this bounded context) and FR-003/FR-004 exactly. Reusing `DuplicateUserError` rather than inventing an invitation-specific "email already registered" error keeps one error type per underlying condition ("this email is already a real account in this org") regardless of which caller (createUser vs. inviteUser) discovers it.

**Alternatives considered**:
- Scope the duplicate-pending check to `(organizationId, teamId, email)` instead — rejected: would allow the same person to accumulate multiple simultaneous pending invitations to different teams in the same organization, which spec.md's Assumptions explicitly reject in favor of the simpler organization-wide rule.
