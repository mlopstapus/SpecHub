# Contract: Identity & Access — API Keys

Adds four functions to `identity-access`'s existing exposed API surface. `bcs/identity-access/CONTRACT.md` already lists `authenticateApiKey`, `createApiKey`, `revokeApiKey` in its table as forward-looking entries; `listApiKeys` is a new addition this feature contributes to that same table, and each existing entry's signature is filled in for the first time below.

## `createApiKey(db, actingUser, params): Promise<{ id: string; rawKey: string }>`

```ts
interface CreateApiKeyParams {
  name: string;
  scopes: string[]; // each matching <resource>:<action>; must be non-empty
  expiresAt?: Date; // omit for a key that never expires
}
```

- Throws `NoScopesSelectedError` if `scopes` is empty.
- Throws `InvalidScopeError` if any scope fails the `<resource>:<action>` shape check (research.md §1).
- Throws `ScopeExceedsPermissionsError` if any scope fails `isScopeAllowedForRole(scope, actingUser.role)` (research.md §2) — a `"member"` caller requesting anything but a `:read` scope.
- On success: generates the raw key and its SHA-256 hash (research.md §3), inserts the row scoped to `actingUser.orgId`/`actingUser.id`, records an audit event (`api_key.created`), and returns the new key's `id` and the raw key value. **This is the only call, ever, that returns the raw key** — it is never retrievable again through `listApiKeys` or any other means (FR-003/SC-003).

## `authenticateApiKey(db, rawKey): Promise<{ user: UserSummary; scopes: string[] } | null>`

- Hashes `rawKey` and looks up a matching row by `key_hash`. Returns `null` (never throws) if:
  - no row matches the hash (unrecognized/malformed key);
  - the matching row's `is_active` is `false` (revoked);
  - the matching row's `expires_at` is set and has passed;
  - the owning user no longer exists, or exists but `is_active` is `false` (research.md §4).
- On a match: updates `last_used_at` to now (FR-007; not wrapped in `withAudit` — authentication itself is not an audited action per this feature's FRs, matching how `authenticateSession` also performs no audit write) and returns the owning user's `UserSummary` plus the key's `scopes`.

## `revokeApiKey(db, actingUser, keyId): Promise<void>`

- Throws `ApiKeyNotFoundError` if no key with this id exists in `actingUser.orgId`.
- Authorization: `actingUser.id === key.userId` (self) OR `actingUser.role === "admin"` (org admin acting on a key belonging to a user in their own organization). Otherwise throws `NotAuthorizedError`.
- No-ops (no error, no audit event) if the key is already inactive — idempotent, matching `revokeInvitation`'s precedent.
- On success: sets `is_active = false`, records an audit event (`api_key.revoked`).

## `listApiKeys(db, actingUser, targetUserId?): Promise<ApiKeySummary[]>`

- `targetUserId` omitted or equal to `actingUser.id`: returns the caller's own keys, no additional authorization needed.
- `targetUserId` set to someone else: requires `actingUser.role === "admin"` (else `NotAuthorizedError`) and that the target user exists in `actingUser.orgId` (else `CrossOrgUserAccessError`, reused from `domain/user.ts`).
- Returns every matching key, newest first. Never includes `keyHash` or the raw key value (FR-009).

## Error → typical caller mapping

None of these errors are mapped to HTTP status codes by this feature (no route exists yet) — that mapping is Distribution's future responsibility via `context/api-conventions.md`'s `DomainError` conventions, the same deferral every prior feature in this epic has left for its own error classes.
