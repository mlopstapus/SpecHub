# Quickstart: Organization Tenant Model

## Prerequisites

- `pnpm install`
- Docker available locally (Testcontainers spins up an ephemeral Postgres instance — no manual DB setup needed for tests)

## Generate the migration

After `src/bcs/identity-access/infrastructure/schema.ts` is written:

```sh
pnpm db:generate
```

Confirms `drizzle/migrations/0001_identity_access_organizations.sql` is produced and review its DDL before committing (per `context/database-conventions.md`'s "migration reviewed in the same PR as the schema change" rule).

## Run this feature's tests

```sh
pnpm vitest run src/bcs/identity-access
```

(`pnpm test -- src/bcs/identity-access` does **not** scope the run — `vitest run`'s own positional filter argument gets swallowed by pnpm's `--` passthrough here, and it silently runs the whole suite instead. Invoke `vitest` directly for a scoped run.)

Expected coverage (see tasks.md for the full breakdown):
- `organizations.slug` has a real DB-level unique constraint (columns/migration test, in the `columns.test.ts` style but against the real migration).
- `getOrganization` returns the `OrgSummary` shape (no `stripe_customer_id`/timestamps leak through).
- `bootstrapOrganization` on an empty self-hosted install creates exactly one Organization row and invokes the injected `provisionTeamAndAdmin` callback with the new `organizationId`.
- `bootstrapOrganization` in self-hosted mode with one existing Organization rejects a second attempt (`SecondOrganizationNotAllowedError`), no row written.
- Two concurrent `bootstrapOrganization` calls against an empty self-hosted install: exactly one succeeds.
- Two concurrent organization creations with the same `slug`: exactly one succeeds, the other fails on the unique constraint.
- If the injected `provisionTeamAndAdmin` callback throws, the Organization row is rolled back too (transaction atomicity).

## Full validation

```sh
pnpm typecheck
pnpm lint
pnpm test
```

## What this feature does *not* yet prove end-to-end

Per spec.md's Assumptions and plan.md's Complexity Tracking:
- A real first-run registration flow producing an actual Team + User row — that requires features 002 (Team Hierarchy) and 003 (User Accounts & Registration), which supply the real `provisionTeamAndAdmin` callback at an actual route-handler call site. Until then, this feature's acceptance criterion "first registration creates one org, one root team, one admin user — verified by test" stays unchecked in `backlog/002-identity-access/001-organization-tenant-model.md` (not archived), per `CLAUDE.md`'s convention for partially-blocked backlog items.
- Audit logging of organization creation (epic 003) or plan/entitlement provisioning (epic 008) — both are tracked forward dependencies, not built here.
