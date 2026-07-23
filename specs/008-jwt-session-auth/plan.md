# Implementation Plan: JWT Session Auth

**Branch**: `008-jwt-session-auth` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-jwt-session-auth/spec.md`

## Summary

Port login/JWT issuance from the legacy Python `auth_service.py` as identity-access application-layer functions — `login`, `authenticateSession`, `logout` — signing/verifying minimal-claim (`sub`/`role`/`exp`) HS256 JWTs via `jose`, delivered as an httpOnly, environment-conditional-secure, `sameSite=lax` session-cookie descriptor for a future Distribution route handler to attach as-is. Adds a fail-closed `JWT_SECRET` validator to `shared/config` (mirroring the existing `DATABASE_URL` placeholder-detection pattern). Per this feature's `/speckit-clarify` session, also pulls forward the *core* of `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md` — the `audit.audit_events` table, redaction, and a `record()` write path — so login (success/failure) and logout can be audit-logged now rather than retrofitted later; the retrofit of already-shipped identity-access mutations stays out of scope and remains tracked on that backlog item.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24 (repo-wide, per `package.json` engines)

**Primary Dependencies**: Drizzle ORM (`drizzle-orm`), `postgres` (postgres-js driver), `bcryptjs` (existing — password verification), `jose` (new — HS256 JWT sign/verify; see research.md §1)

**Storage**: PostgreSQL. No new `identity_access` tables (a session is a stateless signed JWT, never persisted). One new table, `audit.audit_events`, in the already-declared-but-unused `audit` schema (`src/shared/db/schemas.ts`'s `auditSchema`), pulled forward per Clarifications.

**Testing**: Vitest, Testcontainers-backed integration tests via `startTestDb()` (`src/shared/db/test-helpers.ts`), matching `create-user.test.ts`/`bootstrap-organization.test.ts` precedent; pure-function unit tests (Vitest, no container) for JWT sign/verify and the `JWT_SECRET` validator, matching `client.test.ts`'s precedent for `getConnectionString`.

**Target Platform**: Next.js server runtime (Node), self-hosted via Docker Compose or managed SaaS

**Project Type**: Web application — this slice is backend-only: `src/bcs/identity-access/{domain,application,infrastructure}` (login/session/logout), `src/bcs/audit-compliance/{domain,application,infrastructure}` (pulled-forward write path), and `src/shared/config` (JWT secret validator). No route handler or UI page is added (research.md §5 — same deferral `007-user-accounts-registration` already established for this epic).

**Performance Goals**: No feature-specific target beyond standard web-app expectations; not otherwise specified by spec.md.

**Constraints**: JWT signed HS256 with only `sub`/`role`/`exp` claims (`context/auth-conventions.md` — no `orgId`/`teamId` in the token); session cookie `httpOnly` always, `secure` outside local dev (`NODE_ENV !== "production"`), `sameSite=lax`, host-only (no `domain` attribute); `JWT_SECRET` validated fail-closed (missing or placeholder throws, mirroring `getConnectionString`); no raw password, JWT, or token value may ever appear in an audit event's `before`/`after` payload (tenet S3, carried into the new redaction requirement) or in an operational log line (`context/api-conventions.md`'s logging section already excludes this).

**Scale/Scope**: ~10 new files across two BCs plus `shared/config`; one new migration (`audit.audit_events` + its index); two new env vars (`JWT_SECRET`, `JWT_EXPIRY_HOURS`) added to `.env.example`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First**: Every function below (password verify/reject, generic-error non-enumeration, deactivated-user rejection, cookie-flag construction, session resolution for valid/expired/tampered/missing tokens, logout idempotency, `JWT_SECRET` missing/placeholder/valid, audit-event write on login success/failure/logout, redaction of secret fields) gets a failing test first, per `create-user.test.ts`/`client.test.ts` precedent. PASS.
- **II. Domain-Driven Bounded Contexts**: New identity-access code stays under `src/bcs/identity-access/{domain,application,infrastructure}`; new audit-compliance code stays under `src/bcs/audit-compliance/{domain,application,infrastructure}`, exported only via its own `index.ts`. Identity-access calls audit-compliance's `record()` through that barrel — never a direct `audit.audit_events` table write from identity-access code. PASS.
- **III. Domain Invariants in the Domain Layer**: Credential verification, generic-error shaping (no email enumeration), deactivated-account rejection, minimal-claim JWT construction, and "audit write failure blocks reporting login/logout as successful" (FR-013) all live in `application/`, not deferred to a future route handler — consistent with research.md §5's no-route decision. PASS.
- **IV. Multi-Tenant Isolation by Default**: No new `identity_access` table, so no new M1/M2 surface there. The new `audit.audit_events` table carries `organization_id` (M1), nullable per data-model.md's one documented exception, with no FK constraint — matching the actual, already-established codebase convention (`identity_access.teams.organization_id`/`users.organization_id` carry no FK either, despite `context/database-conventions.md`'s aspirational cross-schema-FK text) rather than a new one-off FK this feature would be the first to add — and an `(organization_id, created_at)` index. RLS (M2) is **not** enabled on `audit.audit_events` in this feature — no existing backlog item owns audit-schema RLS (`007-tenant-isolation-tests-and-rls.md` is scoped to `identity_access.*` tables only); tracked as a new gap in Complexity Tracking below rather than silently skipped. PASS, with a documented, newly-surfaced RLS deferral (not a discharge of M2, an explicit gap).
- **V. Secure by Default**: Passwords verified via the existing bcrypt hash, never re-hashed or logged. JWTs signed HS256 with a fail-closed secret (S1/C2 continuity). Redaction strips `password_hash`, `key_hash`, and raw JWT/session-token values from every audit `before`/`after` payload before storage — direct extension of tenet S3, and this feature's own audit events (login/logout) never include the password or token in the first place, not merely redacted after the fact. PASS.
- **VI. Auditable & Compliant (SOC2)**: This feature *is* the first identity-access work to actually close a C1 gap rather than defer it — login (success/failure) and logout write real `audit.audit_events` rows, in scope specifically because of this feature's Clarifications. The remaining C1 gap (org/team/user CRUD mutations shipped before this table existed) stays open, already tracked in `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`'s retrofit bullet — this feature completes that item's schema/write-path requirements only, not its retrofit requirement. PASS for this feature's own scope; pre-existing gap remains explicitly tracked, not newly introduced.
- **VII. Feature-Gated by Entitlement**: No new REST route, MCP tool, or UI surface is added by this feature (research.md §5) — the principle's gate requirement applies to route/tool/UI surfaces, none of which exist yet for this feature to gate. N/A, consistent with `007-user-accounts-registration`'s identical reasoning for its own backend-only scope.

*Re-checked after Phase 1 design below — no new violations introduced by the data model or contracts.*

## Project Structure

### Documentation (this feature)

```text
specs/008-jwt-session-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── identity-access-auth.md
│   └── audit-compliance-record.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
src/shared/config/
└── index.ts                             # add getJwtSecret(env?) — placeholder/missing detection, mirrors client.ts's getConnectionString

src/bcs/audit-compliance/                # pulled forward from backlog/003-audit-compliance/001 (schema + write path only)
├── domain/
│   └── audit-event.ts                   # AuditEvent type, redaction key list
├── application/
│   └── record.ts                        # record(tx, event) — redacts, inserts; only fn exported from index.ts
├── infrastructure/
│   ├── schema.ts                        # audit.audit_events table
│   └── audit-events-repo.ts             # insert(tx, row)
└── index.ts                             # export { record }; export type { AuditEvent }

src/bcs/identity-access/
├── domain/
│   └── session.ts                       # SessionClaims, SessionCookieDescriptor, InvalidCredentialsError (reuses NotAuthorizedError? — see research.md §6)
├── application/
│   ├── login.ts                         # login(db, email, password): Promise<{ user: UserSummary; cookie: SessionCookieDescriptor } | null>
│   ├── authenticate-session.ts          # authenticateSession(cookieHeader): Promise<UserSummary | null>
│   └── logout.ts                        # logout(db, userId): Promise<{ cookie: SessionCookieDescriptor }>
├── infrastructure/
│   └── jwt.ts                           # signSessionJwt(claims), verifySessionJwt(token) — jose HS256, reads getJwtSecret()
└── index.ts                             # add login, authenticateSession, logout exports

drizzle/migrations/
└── <timestamp>_audit_audit_events.sql   # generated via `pnpm db:generate`, renamed per context/database-conventions.md

.env.example                             # add JWT_SECRET, JWT_EXPIRY_HOURS (both REPLACE_ME/placeholder-style)
```

**Structure Decision**: Follows the existing `src/bcs/<context>/{domain,application,infrastructure}` layout. Two BCs are touched because this feature's Clarifications pulled audit-compliance's write path forward — that code still lives under `src/bcs/audit-compliance/`, owned by that BC's eventual epic, not folded into identity-access. No `src/app/` route or UI is added (research.md §5): the actual login/logout HTTP endpoints and the `(auth)/login` UI page remain owned by `backlog/007-distribution/001-rest-api-core-routes.md` and `.../003-web-ui-shell-and-core-pages.md` respectively (both depend on this epic completing first), consistent with `007-user-accounts-registration`'s identical precedent for this same epic.

## Complexity Tracking

> Documented, justified exceptions from the Constitution Check above — not violations requiring a different approach, but deliberate scope boundaries this feature cannot close alone.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| No RLS policy on `audit.audit_events` (Principle IV/M2) | No existing backlog item owns audit-schema RLS — `007-tenant-isolation-tests-and-rls.md` is explicitly scoped to `identity_access.*` tables only, and `003-audit-compliance` has no tenant-isolation-tests item of its own yet | Adding one ad hoc RLS policy here, without the shared cross-tenant-denial test helper `007-tenant-isolation-tests-and-rls.md` builds, would produce an unreviewed, untested policy — worse than an explicitly tracked gap. This plan's tasks.md adds a tracking note to `backlog/003-audit-compliance/EPIC.md` so the gap isn't silently lost (per this repo's forward-dependency-tracking convention). |
| `identity-access` gains a runtime dependency on `audit-compliance`'s `record()` (new — no prior epic-002 feature called into a later epic) | Direct result of this feature's own `/speckit-clarify` session: login/logout audit events are in scope now, not deferred | Reverting to "no audit logging in this feature" would resolve the dependency but was explicitly rejected during clarification in favor of closing the C1 gap immediately for the highest-value security event (authentication) |
| Only `003-audit-compliance/001`'s schema/write-path requirements are completed by this feature, not its retrofit-existing-mutations requirement | Retrofitting `create-organization`/`create-team`/`update-team`/`reparent-team`/`insert-team-between`/`create-user`/`update-user`/`deactivate-user` to call `withAudit()` is a large, separable change touching every already-shipped identity-access mutation — well beyond "JWT session auth" scope | Doing the full retrofit here would make this feature's diff dominated by unrelated file changes and risk regressing already-tested, shipped behavior for a goal (audit coverage of *existing* mutations) this feature's own spec never claimed. `backlog/003-audit-compliance/001-...md` stays `status: open` with its retrofit bullet unchecked, not archived, per this repo's "don't force-complete" convention. |
