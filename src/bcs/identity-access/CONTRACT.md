# Identity & Access — Contract

**Owner:** Ben Anderson
**Status:** Draft

## Purpose

Owns tenancy (`Organization`), the recursive `Team` governance hierarchy within an organization, `User` accounts, invitations, sessions, and scoped API keys. This is the context every other bounded context depends on for "who is this and what org/team are they in" — but it exposes those facts as opaque IDs and read contracts, not as raw table access.

## Exposed APIs

| Endpoint / Method | Description | Consumers |
|---|---|---|
| `getOrganization(organizationId)` | Org record incl. `planId` pointer | All contexts |
| `getUser(userId)` | User record (id, orgId, teamId, role, email) | All contexts |
| `getTeamChain(teamId)` | Ordered list: team → parent → ... → root | Governance |
| `login(db, email, password)` | Verifies credentials (email looked up across all organizations — see 008-jwt-session-auth's research.md §8 — since email is only unique per-org), returns `{ user, cookie }` or `null`; audit-logs every attempt | Distribution (route handlers) |
| `authenticateSession(db, cookieHeader)` | Resolves the calling user from a JWT carried in an httpOnly cookie (web UI); `null` for missing/expired/invalid, never throws | Distribution |
| `logout(db, userId)` | Audit-logs the logout, returns a cookie descriptor clearing the session cookie | Distribution (route handlers) |
| `bootstrapOrganization` | Creates the tenant-root Organization plus (via the real `provisionTeamAndAdmin` callback) the root Team and admin User, atomically — self-hosted first-run only | Distribution (route handlers) |
| `registerFirstRunAdmin` | First-run registration composition: checks the entitlement gate, then calls `bootstrapOrganization` with the real `provisionTeamAndAdmin` | Distribution (route handlers) |
| `updateTeam`, `reparentTeam`, `insertTeamBetween`, `listSubTeams` | Team hierarchy CRUD/reorganization — enforce same-organization and no-cycle invariants regardless of caller | Distribution (route handlers) |
| `createTeam`, `createUser`, `updateUser`, `deactivateUser`, `listUsers` | Standard write/read operations — `createUser`/`updateUser`/`deactivateUser` are admin-only (or self-or-admin for a user's own non-privileged fields); `listUsers` is org-scoped, no role restriction | Distribution (route handlers) |
| `inviteUser(db, actingUser, { teamId, email, role? })` | Creates an invitation (org admin or the target team's owner only); best-effort emails the invite link, attempts delivery via `shared/email` (SMTP if configured, else logs); returns `{ id, token }` — the only place the raw token is ever returned (009-invitations) | Distribution (route handlers) |
| `acceptInvitation(db, token, { username, password, displayName? })` | Redeems a pending, unexpired, unrevoked invitation into a new active user scoped solely to the invitation's own org/team/role — cross-organization redemption is structurally impossible, not just checked; race-safe for concurrent accepts on the same token | Distribution (route handlers) |
| `revokeInvitation(db, actingUser, invitationId)` | Cancels a pending invitation (org admin or the target team's owner only); idempotent no-op if already revoked; rejects if already accepted | Distribution (route handlers) |
| `listInvitations(db, actingUser)` | Org-admin-only; lists an organization's invitations with each one's derived state (pending/accepted/expired/revoked), never the raw token | Distribution (route handlers) |
| `createApiKey(db, actingUser, { name, scopes, expiresAt? })` | Creates a scoped bearer key for `actingUser`; scopes are validated structurally (`<resource>:<action>`) and capped at the creator's own role — a `"member"` may only request `:read` scopes; returns `{ id, rawKey }`, the only place the raw key is ever returned (010-api-keys) | Distribution (route handlers) |
| `authenticateApiKey(db, rawKey)` | Resolves the presented raw key to `{ user, scopes }`, or `null` for any unrecognized/expired/revoked key or one whose owner is deactivated — never throws (010-api-keys) | Distribution |
| `revokeApiKey(db, actingUser, keyId)` | Deactivates a key (self-or-admin: the key's owner, or an org admin acting on a user in their own organization); idempotent no-op if already revoked (010-api-keys) | Distribution (route handlers) |
| `listApiKeys(db, actingUser, targetUserId?)` | Lists keys for `targetUserId` (default: the caller's own); listing another user's keys requires org-admin and same-organization membership; never includes the key hash or raw value (010-api-keys) | Distribution (route handlers) |

## Events Published

| Event | Payload summary | Consumers |
|---|---|---|
| `OrganizationCreated` | orgId, name, createdBy | Billing (provisions default Plan/Entitlement) |
| `UserJoined` | orgId, userId, teamId | Audit |
| `TeamCreated` / `TeamReparented` | orgId, teamId, parentTeamId | Governance (invalidates any cached resolution), Audit |
| `ApiKeyCreated` / `ApiKeyRevoked` | orgId, userId, keyId (never the raw key) | Audit |

## Events Consumed

| Event | From BC | What this BC does with it |
|---|---|---|
| `SubscriptionUpdated` | Billing & Entitlements | Nothing directly — Identity never gates its own writes on entitlements itself; callers (Distribution) check entitlements before calling Identity's write APIs (e.g. "can this org create another team") |

## Data Contracts

```ts
type OrganizationId = string; // uuid
type UserId = string;
type TeamId = string;

interface OrgSummary { id: OrganizationId; name: string; slug: string; planId: string }
interface UserSummary { id: UserId; orgId: OrganizationId; teamId: TeamId; role: "admin" | "member"; email: string }
interface TeamChainEntry { id: TeamId; name: string; parentTeamId: TeamId | null }
interface InvitationSummary { id: string; email: string; teamId: TeamId; role: "admin" | "member"; state: "pending" | "accepted" | "expired" | "revoked"; createdAt: Date }
```

No other context receives a raw `User`/`Team`/`Organization` row — only these summary shapes.

## Stability Guarantees

`OrganizationId`, `UserId`, `TeamId` are stable UUIDs, never reused. `getTeamChain` ordering (self-first, root-last) will not change without a major version bump — Governance's resolution correctness depends on it.

Web UI auth carries forward the current JWT approach (HS256, `sub`/`role`/`exp` claims) rather than switching to opaque server-side sessions, delivered via an httpOnly cookie instead of a client-managed header. Scoped bearer API keys remain the separate, unchanged mechanism for MCP/API access.

## Breaking Change Policy

Any change to the shapes above, or to team-chain ordering, requires updating this file in the same commit and is called out explicitly in the PR description.
