# Implementation Plan: User Accounts & Registration

**Branch**: `007-user-accounts-registration` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-user-accounts-registration/spec.md`

## Summary

Add `identity_access.users` — org-scoped (never globally) unique on `(organization_id, email)` and `(organization_id, username)`, correcting the multi-tenancy bug PDR-003 exists to prevent. Deliver admin-gated CRUD (create/update/deactivate/list), bcrypt password hashing, and the real `provisionTeamAndAdmin` callback that replaces `bootstrapOrganization`'s test-only stub from `005-org-tenant-model`. Also completes `getUser()` (promised by `bcs/identity-access/CONTRACT.md`, blocked until this table existed) and the `teams.owner_id` foreign key deferred by `006-team-hierarchy`. The entitlement gate required by FR-011 is implemented as a hardcoded-enabled local stand-in, not a real `resolveEntitlements()` call — `billing-entitlements` has no implementation yet (epic 008 not started) — mirroring the same temporary-stand-in pattern already used by `backlog/003-audit-compliance/002-audit-query-and-retention.md`.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24 (repo-wide, per `package.json` engines)

**Primary Dependencies**: Drizzle ORM (`drizzle-orm`), `postgres` (postgres-js driver), `bcryptjs` (new — password hashing; see research.md §1)

**Storage**: PostgreSQL, schema `identity_access`, new table `users` (extends the schema already holding `organizations`/`teams`)

**Testing**: Vitest, Testcontainers-backed integration tests via `startTestDb()` (`src/shared/db/test-helpers.ts`), matching `bootstrap-organization.test.ts`/`create-team.test.ts` precedent

**Target Platform**: Next.js server runtime (Node), self-hosted via Docker Compose or managed SaaS

**Project Type**: Web application — this slice is backend-only (`src/bcs/identity-access/{domain,application,infrastructure}`); no route handler or UI is added by this feature (see research.md §5 and Complexity Tracking)

**Performance Goals**: No feature-specific target beyond standard web-app expectations already assumed by prior identity-access features; not otherwise specified by spec.md

**Constraints**: Password hashing must use bcrypt (tenet S1); uniqueness must be enforced at the DB level, not application-only (mirrors `005-org-tenant-model`'s `slug` precedent); `password_hash` must never appear in any returned shape (FR-008)

**Scale/Scope**: One new table, ~6 application-layer functions (`createUser`, `updateUser`, `deactivateUser`, `listUsers`, `getUser`, `provisionTeamAndAdmin` composition), one migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First**: Every function below (uniqueness/case-folding, cross-org team assignment, last-admin guard, password-length rejection, `password_hash` exclusion, atomic real bootstrap wiring) gets a failing Testcontainers-backed test before implementation, per `bootstrap-organization.test.ts`/`create-team.test.ts` precedent. PASS.
- **II. Domain-Driven Bounded Contexts**: All new code lives under `src/bcs/identity-access/{domain,application,infrastructure}`, exported only via `index.ts`; no other BC's models are imported. PASS.
- **III. Domain Invariants in the Domain Layer**: Org-scoping, case-insensitive uniqueness, cross-org team-assignment rejection, last-admin-deactivation guard, password-length validation, and the admin/self-or-admin authorization rule are all enforced inside `application/`, not deferred to a future route handler — see research.md §6 (authorization modeled as an application-layer invariant, since Distribution's route layer doesn't exist yet). PASS.
- **IV. Multi-Tenant Isolation by Default**: `users` carries `organization_id` (M1) and all repo functions filter by it. RLS (M2) is **not** enabled on `users` in this feature — same deferral `teams` already has, owned by `backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md` (already lists this feature as a dependency, and explicitly owns *both* the RLS policies *and* the shared M3 cross-tenant-denial test helper plus its own "one negative test per resource type" acceptance criterion — matching `006-team-hierarchy`'s plan.md, which deliberately made no M3 claim for the same reason). This feature's own tests (`updateUser`/`deactivateUser` rejecting a cross-org target) are a reasonable ad hoc precaution, consistent with `teams`' existing `CrossOrgReparentError` tests — not a discharge of M3, which stays 007's job. PASS, with the same documented RLS deferral `teams` already carries (not a new exception; see data-model.md).
- **V. Secure by Default**: Passwords hashed via bcrypt before persistence (S1); `password_hash` never appears in any returned shape (FR-008, tested directly); no plaintext password field is ever stored. PASS.
- **VI. Auditable & Compliant (SOC2)**: User creation/update/deactivation are **not** wrapped in `withAudit()` — `audit.audit_events` doesn't exist yet (epic 003 depends on epic 002, not the reverse). Already tracked as a retrofit requirement in `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md` (explicitly lists "user creation" in its retrofit bullet). Documented exception, see Complexity Tracking.
- **VII. Feature-Gated by Entitlement**: The first-run registration composition (`registerFirstRunAdmin`) calls a local, hardcoded-enabled stand-in for `requireEntitlement(orgId, "coreFeaturesEnabled")` rather than the real call — `billing-entitlements` (epic 008) has no implementation to call yet. Per the backlog item's own instruction, this is a documented, temporary constitution exception (not a silently skipped gate) — see Complexity Tracking and research.md §4.

*Re-checked after Phase 1 design below — no new violations introduced by the data model or contracts.*

## Project Structure

### Documentation (this feature)

```text
specs/007-user-accounts-registration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── identity-access-users.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
src/bcs/identity-access/
├── domain/
│   └── user.ts                          # User, UserAccountSummary; DuplicateUserError, InvalidTeamAssignmentError,
│                                         # WeakPasswordError, LastActiveAdminError, NotAuthorizedError,
│                                         # CrossOrgUserAccessError, EntitlementRequiredError
├── application/
│   ├── insert-validated-user.ts         # shared, non-authz-gated core: validation + hashing + insert (internal)
│   ├── create-user.ts                   # createUser(tx, actingUser, params) — admin-only (FR-003)
│   ├── update-user.ts                   # updateUser(tx, actingUser, targetUserId, fields) — self-or-admin (FR-004)
│   ├── deactivate-user.ts               # deactivateUser(tx, actingUser, targetUserId) — admin-only + last-admin guard (FR-005, FR-013)
│   ├── list-users.ts                    # listUsers(db, actingUser, filters) — org-scoped, optional team filter (FR-006)
│   ├── get-user.ts                      # getUser(db, userId): Promise<UserSummary> — completes CONTRACT.md's promised API
│   ├── provision-team-and-admin.ts      # makeProvisionTeamAndAdmin(...): ProvisionTeamAndAdmin — real bootstrap callback (FR-010)
│   ├── entitlement-gate.ts              # assertCoreFeaturesEnabled() — temporary hardcoded stand-in (FR-011)
│   └── register-first-run-admin.ts      # registerFirstRunAdmin(db, params) — composes gate + bootstrapOrganization + real callback
├── infrastructure/
│   ├── schema.ts                        # add `users` table; add teams.owner_id → users.id FK (completes 006's deferral)
│   └── users-repo.ts                    # insert, findById, findByOrgAndId, update, countActiveAdmins, listByOrgAndTeam
└── index.ts                             # add createUser, updateUser, deactivateUser, listUsers, getUser, registerFirstRunAdmin exports

drizzle/migrations/
└── <timestamp>_identity_access_users.sql  # generated via `pnpm db:generate`, renamed per context/database-conventions.md
```

**Structure Decision**: Follows the existing `src/bcs/identity-access/{domain,application,infrastructure}` layout established by `005-org-tenant-model`/`006-team-hierarchy` — this feature only adds files within that same BC, consistent with the module-boundary ESLint config already in place. No `src/app/` route or UI is added (research.md §5): the actual first-run registration HTTP endpoint and admin-facing user-management UI are owned by `backlog/007-distribution/001-rest-api-core-routes.md` and `.../003-web-ui-shell-and-core-pages.md` respectively, both of which explicitly depend on this epic completing first rather than the reverse. This feature delivers the application-layer functions those future route handlers will call directly, including the composed, gate-checked `registerFirstRunAdmin` entry point — not a stub this time (unlike `005-org-tenant-model`/`006-team-hierarchy`, which truly had nothing yet to gate).

## Complexity Tracking

> Documented, justified exceptions from the Constitution Check above — not violations requiring a different approach, but deliberate scope boundaries this feature cannot close alone.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| No RLS policy on `identity_access.users` (Principle IV/M2) | `backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md` owns enabling RLS across every `identity_access.*` table in one pass (already lists this feature as a dependency) | Adding one table's RLS policy piecemeal here would fragment that feature's own acceptance criteria and duplicate work it already owns |
| User creation/update/deactivation not wrapped in `withAudit()` (Principle VI) | `audit.audit_events` doesn't exist — epic 003 depends on epic 002, not the reverse | Building a placeholder audit table now just to satisfy the wrapper would be schema churn thrown away once epic 003 defines the real shape; already tracked in `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`'s retrofit bullet (explicitly names "user creation") |
| `registerFirstRunAdmin`'s entitlement check is a hardcoded-`true` local stand-in, not a real `requireEntitlement(orgId, "coreFeaturesEnabled")` call (Principle VII) | `billing-entitlements` (epic 008) has no implementation at all yet — there is no real function to call | Skipping the gate call entirely was explicitly rejected by the backlog item itself; a hardcoded stand-in matching `coreFeaturesEnabled`'s documented Free/Paid default (`context/entitlements.md`) keeps the call site shaped exactly like the eventual real one, so swapping it is a one-line change, not a redesign. Tracked forward in `backlog/008-billing-entitlements/004-entitlement-enforcement-integration.md` (updated in this change to list this call site explicitly) |
| No actual REST route or UI for registration/user-management (implicit in Principle VII's "route/tool/UI surface" framing) | Owned by `backlog/007-distribution/001-rest-api-core-routes.md` / `003-web-ui-shell-and-core-pages.md`, both of which depend on epic 002 completing first | Building a Next.js route/page here would duplicate work Distribution's epic already owns, and that epic's module-boundary/error-mapping conventions (`context/api-conventions.md`) aren't finalized in code yet either |
