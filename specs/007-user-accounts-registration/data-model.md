# Data Model: User Accounts & Registration

## Entity: `User`

Postgres table `identity_access.users`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | Stable, never reused (`bcs/identity-access/CONTRACT.md`'s stability guarantee) |
| `organization_id` | `uuid` | `not null` | Tenant scope (`shared/db/columns.ts`'s `organizationId()`) |
| `team_id` | `uuid` | `not null`, FK → `identity_access.teams.id` | Every user belongs to exactly one team (dependency on `006-team-hierarchy`) |
| `username` | `text` | `not null` | Stored lowercased (research.md §2) — login identifier |
| `display_name` | `text` | `not null` | Presentation only; not subject to uniqueness |
| `email` | `text` | `not null` | Stored lowercased (research.md §2) — login identifier |
| `password_hash` | `text` | nullable | bcrypt hash (`bcryptjs`, cost 12); nullable at the schema level for a future invitation flow (spec.md Assumptions) — this feature never itself inserts a null value |
| `role` | `text` (enum `"admin" \| "member"`) | `not null`, default `"member"` | FR-012, matches `UserSummary.role` |
| `is_active` | `boolean` | `not null`, default `true` | Soft lifecycle flag — never deleted (spec.md Assumptions) |
| `created_at` / `updated_at` | `timestamptz` | `not null`, default `now()` | Standard columns (`shared/db/columns.ts`'s `timestamps()`) |

**Unique constraints**: `(organization_id, email)`, `(organization_id, username)` — FR-002, enforced at the DB level (application-level checks alone are not sufficient, mirroring `organizations.slug`'s precedent). Because `email`/`username` are always stored lowercased (research.md §2), these constraints transitively enforce case-insensitive uniqueness.

**Row-Level Security**: Not enabled in this feature — same deferral already carried by `identity_access.teams`, owned by `backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md` (plan.md's Complexity Tracking).

**Invariants** (enforced in `application/`, per Principle III):
- `team_id` must reference a team belonging to the same `organization_id` (FR-009) — checked identically to `createTeam`'s existing parent-team check; violation throws `InvalidTeamAssignmentError`.
- A password shorter than 8 characters is rejected before hashing or insertion (FR-014) — throws `WeakPasswordError`.
- Deactivating a user that is the organization's last remaining active admin (`role = "admin" AND is_active = true`, count = 1) is rejected (FR-013) — throws `LastActiveAdminError`.
- `createUser`/`updateUser` (privileged fields)/`deactivateUser` require `actingUser.role === "admin"`; `updateUser`'s non-privileged fields (`display_name`) additionally allow `actingUser.id === targetUserId` (FR-003/004/005, research.md §6) — violation throws `NotAuthorizedError`.
- A target user resolved outside the caller's own organization is treated as inaccessible (`CrossOrgUserAccessError`) rather than silently succeeding or leaking existence details across tenants (M3).

## Schema change: `teams.owner_id` gains its foreign key

`006-team-hierarchy`'s `data-model.md` explicitly deferred `owner_id`'s FK ("no FK yet — `identity_access.users` doesn't exist until feature 003"). This feature completes it:

```ts
ownerId: uuid("owner_id").references((): AnyPgColumn => users.id),
```

Nullable, no other behavior change — this only adds Postgres-enforced referential integrity now that the referenced table exists. Uses the same lazy-arrow-function reference pattern already established for `teams.parent_team_id`'s self-FK, since `users` is defined later in `schema.ts` than `teams`.

## Read shapes

### `UserSummary` (cross-BC contract shape, unchanged)

Per `bcs/identity-access/CONTRACT.md` — the *only* shape any other bounded context ever receives:

```ts
interface UserSummary {
  id: string;      // UserId (uuid)
  orgId: string;    // OrganizationId
  teamId: string;
  role: "admin" | "member";
  email: string;
}
```

Never the raw row — no `username`, `display_name`, `is_active`, `password_hash`, or timestamps leak across the BC boundary. Produced by this feature's new `getUser(db, userId)`, completing the API `CONTRACT.md` already promised but that was blocked until this table existed.

### `UserAccountSummary` (this feature's own CRUD response shape)

A richer shape for identity-access's own admin-facing operations (create/update/list/deactivate) — still excludes `password_hash` (FR-008):

```ts
interface UserAccountSummary {
  id: string;
  organizationId: string;
  teamId: string;
  username: string;
  displayName: string;
  email: string;
  role: "admin" | "member";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Composability seam completed: `provisionTeamAndAdmin`

`005-org-tenant-model`'s `bootstrapOrganization` accepts a `ProvisionTeamAndAdmin` callback type, previously only satisfied by tests' stub implementations. This feature supplies the real one via `makeProvisionTeamAndAdmin(adminParams)` (research.md §3), composing `createTeam` + the shared `insertValidatedUser` core + a `teams-repo.update` call to set the new team's `owner_id`.

## State transitions

`User.is_active`: `true` → `false` via `deactivateUser` only (one-directional in this feature — no reactivation path is requested by spec.md, and none is added). `User.role`: `"member"` ⇄ `"admin"` via `updateUser` (admin-only), with no additional guard beyond the existing authorization check — the last-admin guard applies only to deactivation (FR-013), not to a role change away from `"admin"` (out of scope per spec.md, which specifies the guard for deactivation only).
