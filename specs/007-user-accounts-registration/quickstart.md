# Quickstart: User Accounts & Registration

## Prerequisites

- `pnpm install` (adds `bcryptjs` as a new dependency — research.md §1)
- Docker available locally (Testcontainers spins up an ephemeral Postgres instance — no manual DB setup needed for tests)

## Generate the migration

After `src/bcs/identity-access/infrastructure/schema.ts` is updated (new `users` table, `teams.owner_id` FK):

```sh
MIGRATION_DATABASE_URL="postgresql://x:x@localhost:5432/skillcanon" pnpm db:generate
```

(`MIGRATION_DATABASE_URL` must look real even with no live DB reachable — `drizzle.config.ts` evaluates it eagerly; per `CLAUDE.md`.) Rename the generated file and its `_journal.json` tag from drizzle-kit's random adjective-noun tag to `000N_identity_access_users` (matching the sequential-number convention `0001_identity_access_organizations`/`0002_identity_access_teams` already established — `context/database-conventions.md`'s literal "`<timestamp>_...`" wording isn't what this repo's prior migrations actually do), and review its DDL before committing — it should include both the new `users` table and the `ALTER TABLE teams ADD CONSTRAINT ... FOREIGN KEY (owner_id) REFERENCES users(id)` statement.

## Run this feature's tests

```sh
pnpm vitest run src/bcs/identity-access
```

(`pnpm test -- src/bcs/identity-access` does **not** scope the run — invoke `vitest` directly; per `CLAUDE.md`.)

Expected coverage (see tasks.md for the full breakdown):
- `(organization_id, email)` / `(organization_id, username)` have real DB-level unique constraints, and two organizations can each use `admin@example.com` with no conflict (SC-001).
- Values differing only by case (`Admin` vs `admin`) collide as duplicates within one organization (SC-002, Clarifications).
- `createUser` rejects a `teamId` belonging to a different organization (`InvalidTeamAssignmentError`).
- `createUser` rejects a password under 8 characters before writing any row (SC-007).
- `createUser`/`updateUser`/`deactivateUser` reject a non-admin caller (`NotAuthorizedError`), except `updateUser`'s self-`displayName` case.
- `deactivateUser` rejects deactivating an organization's last remaining active admin (SC-006), and sets `is_active = false` for any other target.
- `listUsers` never returns another organization's users, and correctly filters by `teamId` when given.
- `password_hash` never appears anywhere it could (SC-003): structurally guaranteed for `createUser` (`{id}` only), `updateUser`/`deactivateUser` (`void`), and behaviorally asserted for `listUsers`/`getUser` (the two shapes that do carry user data) via `Object.keys(result)` exclusion checks.
- `getUser` returns the exact `UserSummary` shape (`id`, `orgId`, `teamId`, `role`, `email`).
- `registerFirstRunAdmin` on a fresh self-hosted install creates a real `Organization` + root `Team` + admin `User`, all correctly linked, with the team's `owner_id` set to the new user's id (SC-004).
- `registerFirstRunAdmin` rolls back the entire transaction if a later step fails partway (e.g. a second first-run attempt tripping the self-hosted single-org guard).
- `assertCoreFeaturesEnabled()` is called on every registration attempt, and its fail-closed path is proven directly: when mocked to throw, `registerFirstRunAdmin` propagates `EntitlementRequiredError` and zero Organization/Team/User rows are written.

## Full validation

```sh
pnpm typecheck
pnpm lint
pnpm test
```

## What this feature does *not* yet prove end-to-end

Per plan.md's Complexity Tracking and research.md §4–5:
- An actual HTTP first-run registration endpoint or admin-facing user-management UI — both are `backlog/007-distribution` features (`001-rest-api-core-routes.md`, `003-web-ui-shell-and-core-pages.md`), which depend on this epic completing first. This feature delivers the application-layer functions those routes will call directly.
- A real `resolveEntitlements()`/`requireEntitlement()` call gating registration — `registerFirstRunAdmin` uses a hardcoded-enabled stand-in (research.md §4) until `backlog/008-billing-entitlements/004-entitlement-enforcement-integration.md` swaps it for the real call.
- RLS enforcement on `identity_access.users` — deferred to `backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md`; this feature only proves app-layer (M1) scoping.
- Audit logging of user creation/update/deactivation — tracked forward in `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`'s existing retrofit bullet.
