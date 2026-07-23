# Contract: Identity & Access — User surface

This feature adds the following to `src/bcs/identity-access/index.ts` (the BC's only public surface, per `context/repo-structure.md`). `bcs/identity-access/CONTRACT.md` is updated in the same change, per its own Breaking Change Policy.

## `getUser(db, userId: string): Promise<UserSummary>`

Reads one user by id, returning the `UserSummary` shape only (`id`, `orgId`, `teamId`, `role`, `email` — never `username`, `display_name`, `is_active`, `password_hash`, or timestamps). Throws a plain `Error` if no user with that id exists, matching `getOrganization`/`getTeamChain`'s existing not-found convention.

**Consumers**: All bounded contexts (per `CONTRACT.md`), plus any future route handler in `src/app/`. Completes an API `CONTRACT.md` already listed before this feature existed to implement it.

## `createUser(tx, actingUser: UserSummary, params: CreateUserParams): Promise<{ id: string }>`

```ts
interface CreateUserParams {
  teamId: string;
  username: string;
  displayName?: string; // defaults to username
  email: string;
  password: string; // plaintext in, never stored or returned as such
  role?: "admin" | "member"; // defaults to "member"
}
```

Creates a user within `actingUser.orgId` (never a caller-supplied organization — FR-003). Requires `actingUser.role === "admin"`, else throws `NotAuthorizedError`. Validates `teamId` belongs to the same organization (else `InvalidTeamAssignmentError`), validates password length ≥ 8 (else `WeakPasswordError`), hashes via bcrypt, normalizes `email`/`username` to lowercase, and translates a unique-constraint violation into `DuplicateUserError`.

**Consumers**: Not currently called by any route — this feature adds the function; `backlog/007-distribution/001-rest-api-core-routes.md`'s ported `users.py` route calls it once that epic exists.

## `updateUser(tx, actingUser: UserSummary, targetUserId: string, fields: UpdateUserFields): Promise<void>`

```ts
interface UpdateUserFields {
  displayName?: string;
  email?: string;
  username?: string;
  role?: "admin" | "member";
  isActive?: boolean;
  teamId?: string;
}
```

If `targetUserId` resolves to a user outside `actingUser.orgId`, throws `CrossOrgUserAccessError`. If `actingUser.id === targetUserId` and `actingUser.role !== "admin"`, only `displayName` may be set — any other field throws `NotAuthorizedError`. Otherwise requires `actingUser.role === "admin"`. A `teamId` change is validated the same way as `createUser`'s (`InvalidTeamAssignmentError` on cross-org). `organization_id` is never an updatable field (no legitimate cross-tenant reassignment flow exists).

## `deactivateUser(tx, actingUser: UserSummary, targetUserId: string): Promise<void>`

Requires `actingUser.role === "admin"`. Cross-org target resolves to `CrossOrgUserAccessError`. If the target is the organization's last remaining active admin, throws `LastActiveAdminError` (FR-013) — no row is changed. Otherwise sets `is_active = false`.

## `listUsers(db, actingUser: UserSummary, filters?: { teamId?: string }): Promise<UserAccountSummary[]>`

Always scoped to `actingUser.orgId` (never a caller-supplied organization, closing the class of bug this codebase has previously caught in a repo function that accepted but didn't filter by `organizationId`). Optionally filtered to `filters.teamId`. No role restriction — any authenticated user may list their own organization's roster (spec.md's FR-006 does not restrict this to admins).

## `registerFirstRunAdmin(db, params: RegisterFirstRunAdminParams): Promise<{ organizationId: string; teamId: string; userId: string }>`

```ts
interface RegisterFirstRunAdminParams {
  organization: { name: string; slug: string };
  team: { name: string; slug: string };
  admin: { username: string; displayName?: string; email: string; password: string };
}
```

Calls `assertCoreFeaturesEnabled()` (research.md §4) before doing any work — throws `EntitlementRequiredError` if disabled. Then calls `bootstrapOrganization(db, params.organization, makeProvisionTeamAndAdmin(params.team, params.admin))`, replacing the test-only stub `005-org-tenant-model` supplied with a real `Team` + admin `User` creation (FR-010).

**Consumers**: Not currently called by any route — `backlog/007-distribution/001-rest-api-core-routes.md`'s registration endpoint calls it once that epic exists (research.md §5).

## Not exposed

`insertValidatedUser` (the shared, non-authorization-gated core used internally by both `createUser` and `provisionTeamAndAdmin`) and `assertCoreFeaturesEnabled` stay internal to `application/` — not re-exported from `index.ts`.
