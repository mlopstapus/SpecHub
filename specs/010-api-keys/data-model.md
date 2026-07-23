# Data Model: API Keys

## `identity_access.api_keys`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid`, PK, default random | Standard (`shared/db/columns.ts`'s `id()`) |
| `organization_id` | `uuid`, not null | Standard (`organizationId()`); no FK, matching every other `organization_id` column in this codebase (`CLAUDE.md`) |
| `user_id` | `uuid`, not null | FK → `identity_access.users.id` — the owning user |
| `name` | `text`, not null | Creator-chosen label; no uniqueness constraint (spec.md Assumptions) |
| `key_hash` | `text`, not null, **unique** | SHA-256 hex digest of the raw key (research.md §3) |
| `prefix` | `text`, not null | First 12 characters of the raw key — display-only, non-secret |
| `scopes` | `jsonb`, not null | `string[]`, each matching `<resource>:<action>` (research.md §1); never empty (FR-002) |
| `expires_at` | `timestamptz`, nullable | `null` = never expires (spec.md Assumptions — no default expiry) |
| `is_active` | `boolean`, not null, default `true` | Set to `false` by `revokeApiKey`; never set back to `true` |
| `last_used_at` | `timestamptz`, nullable | Updated on every successful `authenticateApiKey` call (FR-007); not audited (see contracts/api-keys.md) |
| `created_at` / `updated_at` | `timestamptz`, not null, default `now()` | Standard (`timestamps()`) |

**Index**: `(organization_id, user_id)`, non-unique — supports `listApiKeys`' scoped query, matching `invitations`' `(organization_id, email)` index precedent.

**No RLS policy** on this table yet — same deferral `identity_access.teams`/`users`/`invitations` already carry (plan.md's Complexity Tracking, owned by `007-tenant-isolation-tests-and-rls.md`).

## Scope shape and permission cap (not columns — pure functions in `domain/api-key.ts`)

```ts
const SCOPE_SHAPE = /^[a-z][a-z0-9-]*:(read|write|run)$/;

function isValidScopeShape(scope: string): boolean {
  return SCOPE_SHAPE.test(scope);
}

function isScopeAllowedForRole(scope: string, role: UserRole): boolean {
  if (role === "admin") return true;
  return scope.endsWith(":read");
}
```

See research.md §1–2 for the reasoning behind both rules.

## TypeScript shapes (`domain/api-key.ts`)

```ts
export interface ApiKey {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** FR-009's list/detail shape — never includes `keyHash` or the raw key. */
export interface ApiKeySummary {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}
```

## Error classes (`domain/api-key.ts`)

| Class | Thrown when |
|---|---|
| `NoScopesSelectedError` | `createApiKey` is called with an empty scopes array (FR-002) |
| `InvalidScopeError` | Any requested scope fails `isValidScopeShape` (FR-002, edge cases) |
| `ScopeExceedsPermissionsError` | Any requested scope fails `isScopeAllowedForRole` for the creator's role (FR-003) |
| `ApiKeyNotFoundError` | `revokeApiKey` is called with an id matching no row in the caller's organization |

Reused from `domain/user.ts` (not redeclared): `NotAuthorizedError` (revocation/listing by a caller who is neither the owner nor an org admin), `CrossOrgUserAccessError` (`listApiKeys` called with a `targetUserId` outside the caller's organization).

## Relationships

- `api_keys.user_id` → `users.id`, no `ON DELETE` cascade/set-null (no precedent for cascading deletes in this schema, matching `invitations.invited_by_id`). Users are never hard-deleted in this codebase (only deactivated), so this FK never blocks a delete in practice.
- `api_keys.organization_id`: the tenant boundary; stored directly rather than derived from `user_id` at read time, matching `users`/`invitations`' own pattern of storing organization membership directly rather than deriving it through a join.
