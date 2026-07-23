# Quickstart: Team Hierarchy

## Prerequisites

- `pnpm install`
- Docker available locally (Testcontainers, same as `005-org-tenant-model`)

## Generate the migration

After `src/bcs/identity-access/infrastructure/schema.ts` is updated with the `teams` table:

```sh
MIGRATION_DATABASE_URL="postgresql://x:x@localhost:5432/spechub" pnpm db:generate
```

Confirm `drizzle/migrations/0002_identity_access_teams.sql` creates `teams` with a composite unique constraint on `(organization_id, slug)` and a self-referential FK on `parent_team_id`. Rename the file and update `drizzle/migrations/meta/_journal.json`'s `tag` to `<timestamp>_identity_access_teams` before committing, per `context/database-conventions.md`.

## Run this feature's tests

```sh
pnpm vitest run src/bcs/identity-access
```

Expected coverage:
- `teams` migration creates the composite unique constraint and self-referential FK correctly.
- `createTeam` creates a root-level team (no parent) and a nested team (with parent), rejecting a parent from a different organization.
- `updateTeam` updates name/description/owner without touching hierarchy position.
- `getTeamChain` returns self-first/root-last ordering for a multi-level fixture, matching a characterization test derived from the current Python `get_team_chain` (research.md §6).
- `getTeamChain` on a nonexistent team throws.
- `reparentTeam` rejects a cross-organization move, no row changes.
- `reparentTeam` rejects a cycle-creating move, no row changes.
- Two concurrent reparents that would jointly create a cycle: exactly one succeeds.
- `insertTeamBetween` correctly splices a new team into an existing parent-child link, leaving every other team untouched.
- `insertTeamBetween` against a nonexistent child team is rejected, no team created.

## Full validation

```sh
pnpm typecheck
pnpm lint
pnpm test
```

## What this feature does *not* yet prove

- RLS enforcement on `teams` — deferred to `007-tenant-isolation-tests-and-rls.md` (plan.md's Complexity Tracking).
- Authorization (who may create/reparent a team) — deferred to features 003/004 (Assumptions).
- Audit logging of reparents — forward-tracked in `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`.
