# Quickstart: API Keys

Validates the feature end-to-end at the application layer (no route/UI exists yet — see plan.md/research.md §5).

## Prerequisites

- Local Postgres reachable via `DATABASE_URL`/`MIGRATION_DATABASE_URL` (or let Testcontainers provision one automatically — see below).
- No new dependency (`node:crypto` is built in).
- Migrations applied: `pnpm db:migrate` (after `pnpm db:generate` has produced this feature's migration — see tasks.md).

## Run the automated coverage

```bash
pnpm vitest run src/bcs/identity-access/application/create-api-key.test.ts
pnpm vitest run src/bcs/identity-access/application/authenticate-api-key.test.ts
pnpm vitest run src/bcs/identity-access/application/revoke-api-key.test.ts
pnpm vitest run src/bcs/identity-access/application/list-api-keys.test.ts
pnpm vitest run src/bcs/identity-access/infrastructure/api-keys-repo.test.ts
pnpm vitest run src/bcs/identity-access/infrastructure/schema.test.ts
```

Each spins up its own ephemeral Postgres via Testcontainers (`startTestDb()`) where DB access is needed — no manual setup beyond Docker being available, matching every other identity-access test file.

## Manual, function-level walkthrough (no HTTP layer yet)

Exercised the same way prior features in this epic were validated pre-route — via the Vitest tests themselves — but conceptually:

1. **Create**: `createApiKey(db, member, { name: "My IDE", scopes: ["prompts:read"] })` → returns `{ id, rawKey }`. `rawKey` starts with `sk_`; note it down, it is never shown again.
2. **Scope cap enforced**: `createApiKey(db, member, { name: "Too broad", scopes: ["prompts:write"] })` → throws `ScopeExceedsPermissionsError` (a `"member"` cannot mint a write-scoped key); the same call with an `"admin"` caller succeeds.
3. **Authenticate**: `authenticateApiKey(db, rawKey)` → returns `{ user, scopes: ["prompts:read"] }` where `user.id`/`user.orgId` match the key's owner. Confirm the row's `last_used_at` is now set.
4. **Bad key rejected**: `authenticateApiKey(db, "not-a-real-key")` → returns `null`, does not throw.
5. **List**: `listApiKeys(db, member)` → shows the key with its `prefix`, `scopes`, `isActive: true`, and the `lastUsedAt` timestamp from step 3 — no `keyHash` or raw value anywhere in the result.
6. **Revoke**: `revokeApiKey(db, member, id)` → key's `isActive` becomes `false`. A subsequent `authenticateApiKey(db, rawKey)` call now returns `null`.
7. **Deactivated owner**: Deactivate the owning user (`deactivateUser`), then call `authenticateApiKey` with a still-unexpired, still-active key belonging to that user → returns `null` (research.md §4).

## Expected outcomes (ties back to spec.md's Success Criteria)

- SC-001/SC-004/SC-005 are directly exercised by steps 1, 3, and 6 above.
- SC-002 (expired/revoked keys always rejected) is exercised by steps 4, 6, and an additional expired-key case in the automated tests.
- SC-003 (raw key retrievable in exactly one place) is exercised by step 5 — the raw value from step 1 never reappears in any subsequent call's output.
