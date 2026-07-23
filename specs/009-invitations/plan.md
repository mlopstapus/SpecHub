# Implementation Plan: Invitations

**Branch**: `009-invitations` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-invitations/spec.md`

## Summary

Port the invitation flow from legacy Python `invitation_service.py` as new `identity-access` application-layer functions — `inviteUser`, `acceptInvitation`, `revokeInvitation`, `listInvitations` — backed by a new `identity_access.invitations` table. Authorization is admin-or-target-team-owner (per Clarifications), invitation state (pending/accepted/expired/revoked) is derived from `accepted_at`/`revoked_at`/`expires_at` rather than stored as its own enum column, and acceptance reuses the existing `insertValidatedUser` core (shared with `createUser`) so the resulting account is scoped solely to the invitation's own organization/team/role (FR-007). Closes the "actual email" gap the backlog item calls out: adds a new `shared/email` module implementing the SMTP half of `context/third-party-services.md`'s decision (self-host fallback) via `nodemailer`, with SES (managed-SaaS path) explicitly deferred and tracked. This is also the first feature to give `shared/db/with-audit.ts`'s `withAudit()` a real caller (create/accept/revoke each mutate + audit atomically) and the first to give `shared/logging` a real implementation (a `pino` logger, used for the "no email provider configured" log-fallback line).

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24 (repo-wide, per `package.json` engines)

**Primary Dependencies**: Drizzle ORM (`drizzle-orm`), `postgres` (postgres-js driver), `bcryptjs` (existing — reused via `insertValidatedUser`), `pino` (existing, currently unused — first real logger implementation), `nodemailer` (new — SMTP sending; see research.md §4), `node:crypto` (built-in — token generation, no new dependency)

**Storage**: PostgreSQL. One new table, `identity_access.invitations` (org + team scoped, unique `token`).

**Testing**: Vitest, Testcontainers-backed integration tests via `startTestDb()` for anything touching the DB (`invite-user.test.ts`, `accept-invitation.test.ts`, `revoke-invitation.test.ts`, `list-invitations.test.ts`, `invitations-repo` coverage folded into those, `schema.test.ts` for the real-migration constraint checks), matching `create-user.test.ts`/`schema.test.ts` precedent; pure-function unit tests (Vitest, no container, mocking `nodemailer` and spying through the `@/shared/email` barrel — matching `CLAUDE.md`'s documented cross-BC-spy pattern) for `shared/email` and the invitation-state-derivation helper.

**Target Platform**: Next.js server runtime (Node), self-hosted via Docker Compose or managed SaaS

**Project Type**: Web application — this slice is backend-only: `src/bcs/identity-access/{domain,application,infrastructure}` (invitation CRUD), `src/shared/email` (new), `src/shared/logging` (first real implementation), `src/shared/config` (two new getters). No route handler or UI page is added — same deferral `007-user-accounts-registration`/`008-jwt-session-auth` already established for this epic (research.md §7); `bcs/identity-access/OWNERSHIP.md`'s `/invite/[token]` UI path remains unbuilt until Distribution's epic.

**Performance Goals**: No feature-specific target beyond standard web-app expectations; not otherwise specified by spec.md.

**Constraints**: Invitation tokens are unguessable (32 bytes of CSPRNG output, base64url-encoded — research.md §2) and unique; acceptance is concurrency-safe (a conditional update ensures only one of two simultaneous accept attempts on the same token succeeds — research.md §6); the resulting account's organization/team/role come only from the invitation row, never from any acceptance-flow input (FR-007); email delivery is best-effort and never blocks or rolls back invitation creation (FR-005, edge cases); no raw token value may appear in an audit event's `before`/`after` payload (already covered by `audit-event.ts`'s existing `REDACTED_KEYS`, which includes `"token"`) or in an operational log line — the log-fallback line logs the composed message (which includes the invite link/token for retrieval) deliberately, as that is its documented purpose (FR-005), not an accidental leak.

**Scale/Scope**: ~14 new files across `identity-access`, two new shared modules (`shared/email`, first-real `shared/logging`), two new `shared/config` getters; one new migration (`identity_access.invitations`); two new dependencies (`nodemailer`, `@types/nodemailer`); three new env vars (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`, `INVITATION_EXPIRY_HOURS`, `APP_BASE_URL`) added to `.env.example`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First**: Every function below (authorization admin-or-owner, duplicate-pending-invite rejection, duplicate-registered-email rejection, cross-org email non-blocking, token uniqueness/expiry, concurrent-accept race safety, cross-org-redemption impossibility, username-collision-without-burning-token, revoke-pending vs. revoke-already-accepted vs. revoke-already-revoked, org-scoped listing, state derivation for all four values, SMTP-configured vs. unconfigured email paths) gets a failing test first, per `create-user.test.ts`/`login.test.ts` precedent. PASS.
- **II. Domain-Driven Bounded Contexts**: New code stays under `src/bcs/identity-access/{domain,application,infrastructure}`, exported only via its own `index.ts`. `shared/email` and `shared/logging` are cross-cutting kernel modules (like `shared/db`), not owned by any one BC — `identity-access` calls them the same way `identity-access` already calls `shared/config`. Audit writes go through `audit-compliance`'s `record()` via `withAudit()`, never a direct table write. PASS.
- **III. Domain Invariants in the Domain Layer**: Authorization (admin-or-team-owner), duplicate/cross-org checks, token generation/expiry, state derivation, and "email failure never blocks invitation creation" all live in `application/`, not deferred to a future route handler. PASS.
- **IV. Multi-Tenant Isolation by Default**: `identity_access.invitations` carries `organization_id` (M1, not null, no FK per this codebase's established organization_id-carries-no-FK precedent — `CLAUDE.md`). Every repo query filtering by organization is scoped explicitly (M1). RLS (M2) is **not** enabled on this table in this feature — same deferral `identity_access.teams`/`users` already carry, owned by `007-tenant-isolation-tests-and-rls.md` (not a new gap, just this table joining an existing one). A negative cross-org test is included for token redemption specifically (FR-007/M3), even ahead of that item's own RLS work, because it's a functional requirement of this feature, not solely a tenant-isolation-test-suite concern. PASS, with the same documented RLS deferral prior features in this epic already carry.
- **V. Secure by Default**: Tokens are CSPRNG-generated and never logged in any operational log line derived from an error/audit path (only the deliberate "email skipped" info line includes it, which is the intended retrieval mechanism for self-host, not a leak). Passwords go through the existing bcrypt path (`insertValidatedUser`) unchanged. Audit `before`/`after` payloads already strip `token` via the pre-existing `REDACTED_KEYS` list — this feature adds no new secret-shaped field that list doesn't already cover. PASS.
- **VI. Auditable & Compliant (SOC2)**: Invitation creation, acceptance, and revocation are each audited (FR-012) via `withAudit()` — the first real (non-test) caller of that shared primitive. PASS.
- **VII. Feature-Gated by Entitlement**: No new REST route, MCP tool, or UI surface is added by this feature — same reasoning as `007-user-accounts-registration`/`008-jwt-session-auth`. N/A.

*Re-checked after Phase 1 design below — no new violations introduced by the data model or contracts.*

## Project Structure

### Documentation (this feature)

```text
specs/009-invitations/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── identity-access-invitations.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
src/shared/config/
└── index.ts                             # add getInvitationExpiryHours(env?), getAppBaseUrl(env?), getSmtpConfig(env?)

src/shared/logging/
└── index.ts                             # first real implementation: export const logger = pino(...)

src/shared/email/                        # new shared kernel module
├── send-email.ts                        # sendEmail({ to, subject, text }) — SMTP via nodemailer if configured, else logs and returns
├── send-email.test.ts
└── index.ts                             # export { sendEmail }; export type { EmailMessage }

src/bcs/identity-access/
├── domain/
│   └── invitation.ts                    # Invitation, InvitationState, InvitationSummary types + error classes
├── application/
│   ├── invite-user.ts                   # inviteUser(db, actingUser, params)
│   ├── invite-user.test.ts
│   ├── accept-invitation.ts             # acceptInvitation(db, token, { username, password, displayName? })
│   ├── accept-invitation.test.ts
│   ├── revoke-invitation.ts             # revokeInvitation(db, actingUser, invitationId)
│   ├── revoke-invitation.test.ts
│   ├── list-invitations.ts              # listInvitations(db, actingUser)
│   └── list-invitations.test.ts
├── infrastructure/
│   ├── schema.ts                        # add invitations table
│   ├── schema.test.ts                   # add invitations constraint assertions (real migration)
│   └── invitations-repo.ts              # insert, findByToken, findById, findActivePendingByEmail, listByOrganization, markAccepted (conditional), markRevoked
└── index.ts                             # add inviteUser, acceptInvitation, revokeInvitation, listInvitations exports + types

drizzle/migrations/
└── <timestamp>_identity_access_invitations.sql   # generated via `pnpm db:generate`, renamed per context/database-conventions.md

context/third-party-services.md          # append an "Implementation status" note: SMTP path done (this feature); SES path still not wired, tracked for the SaaS deployment work

.env.example                             # add SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM, INVITATION_EXPIRY_HOURS, APP_BASE_URL

package.json                             # add nodemailer, @types/nodemailer
```

**Structure Decision**: Follows the existing `src/bcs/<context>/{domain,application,infrastructure}` layout, plus two cross-cutting `shared/` kernel additions (`shared/email` new, `shared/logging` promoted from empty barrel to real) alongside the existing `shared/config`/`shared/db`. No `src/app/` route or UI is added: the actual invite/accept HTTP endpoints and the `/invite/[token]` UI page remain owned by `backlog/007-distribution`'s routing and UI-shell items (both depend on this epic completing first), consistent with `007-user-accounts-registration`/`008-jwt-session-auth`'s identical precedent for this same epic.

## Complexity Tracking

> Documented, justified exceptions from the Constitution Check above — not violations requiring a different approach, but deliberate scope boundaries this feature cannot close alone.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| No RLS policy on `identity_access.invitations` (Principle IV/M2) | Same, already-tracked gap `identity_access.teams`/`users` carry — owned by `007-tenant-isolation-tests-and-rls.md`, which this feature does not pull forward | Adding one ad hoc RLS policy here, ahead of that item's shared cross-tenant-denial test helper, would produce an unreviewed, untested policy inconsistent with how the rest of this schema's RLS rollout is sequenced |
| SES (managed-SaaS email path) from `context/third-party-services.md` is not implemented — only the generic SMTP self-host fallback is | No SaaS deployment/AWS-credential surface exists yet in this codebase to test or configure against; building it now would be speculative infrastructure with no way to verify it works | Implementing a stub/mocked SES call "for completeness" was rejected — an untestable, unverified SES code path is worse than an honestly-tracked gap. Tracked via a new "Implementation status" note appended to `context/third-party-services.md` itself (that document has no other backlog item to attach to, since its originating foundations item is already archived/done) rather than silently left implicit. |
| `identity-access` gains a runtime dependency on the new `shared/email` module | Direct requirement of this feature's own backlog item ("this feature also closes that gap") — invitation creation must attempt real delivery, not remain a stub | Leaving email creation to only ever log (never actually send) would leave the backlog item's stated gap open, which this feature exists specifically to close |
