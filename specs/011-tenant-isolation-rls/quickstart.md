# Quickstart: Validating Tenant Isolation Tests & RLS

## Prerequisites

- Local dev deps installed (`pnpm install`).
- Docker available (Testcontainers spins up an ephemeral Postgres per test file — no manual DB setup needed; see `context/testing-strategy.md`).
- `MIGRATION_DATABASE_URL` set to any real-looking value if running `pnpm db:generate`/`db:migrate` outside a test (per `CLAUDE.md`'s existing note) — not required for the test suite itself, which provisions its own container.

## 1. Confirm the new migration applies cleanly

```bash
pnpm vitest run src/shared/db/columns.test.ts src/shared/db/tenant-context.test.ts
```

These don't touch the new migration directly, but they exercise the same `startTestDb()`/`migrate()` path every other test uses — a fast signal the migration set (including the new `0007_identity_access_rls.sql`) still applies without error before running the larger identity-access suite.

## 2. Run the identity-access suite in full

```bash
pnpm vitest run src/bcs/identity-access
```

Expected: every existing test file passes, now exercising the fixture/function-under-test split described in research.md §4 (`testDb.authDb` for setup and the four no-context flows; `withTenantContext(testDb.appDb, orgId, ...)` for the rest). A failure here before any new M3 test is added indicates an existing test wasn't migrated correctly (see tasks.md's per-file breakdown) — not a new RLS bug.

## 3. Run the new cross-tenant-denial tests

```bash
pnpm vitest run src/bcs/identity-access/tenant-isolation.test.ts
```

(Exact file name/location decided in tasks.md — one M3 test per resource type: `organizations`, `teams`, `users`, `invitations`, `api_keys`.) Each test:
- Creates two organizations (via `testDb.authDb`) and one resource of the type under test in organization B.
- Uses `assertCrossTenantDenied` (contracts/tenant-isolation-test-helper.md) twice per resource type: once through the real application function (app-layer denial, M1) and once through a raw query with no app-layer filter, scoped only by `withTenantContext` + RLS (M2 backstop, FR-007's "disable the app filter, RLS still denies" proof).

## 4. Confirm the credential-resolution flows still work under real RLS

```bash
pnpm vitest run src/bcs/identity-access/application/login.test.ts \
  src/bcs/identity-access/application/authenticate-session.test.ts \
  src/bcs/identity-access/application/authenticate-api-key.test.ts \
  src/bcs/identity-access/application/accept-invitation.test.ts
```

These four are the ones research.md §2 identifies as needing the `skillcanon_auth` role — their tests now call through `testDb.authDb` end-to-end, proving login/session/API-key auth/invitation acceptance keep working once RLS is live, not just under a full-bypass connection.

## 5. Full suite + lint + typecheck (final gate before `/as-finish`)

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Manual sanity check (optional, illustrative — not part of the automated suite)

Connect to a locally running `docker compose` Postgres as `skillcanon_app` and confirm a bare query with no session variable set fails outright:

```sql
select * from identity_access.users; -- expect: ERROR: unrecognized configuration parameter "app.current_org_id"
```

Then, as the same role, after `select set_config('app.current_org_id', '<some-uuid>', false);`, confirm only that organization's rows are visible.
