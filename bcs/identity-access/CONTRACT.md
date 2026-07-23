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
| `authenticateApiKey(rawKey)` | Resolves the calling user + scopes from a bearer key | Distribution |
| `bootstrapOrganization` | Creates the tenant-root Organization plus (via the real `provisionTeamAndAdmin` callback) the root Team and admin User, atomically — self-hosted first-run only | Distribution (route handlers) |
| `registerFirstRunAdmin` | First-run registration composition: checks the entitlement gate, then calls `bootstrapOrganization` with the real `provisionTeamAndAdmin` | Distribution (route handlers) |
| `updateTeam`, `reparentTeam`, `insertTeamBetween`, `listSubTeams` | Team hierarchy CRUD/reorganization — enforce same-organization and no-cycle invariants regardless of caller | Distribution (route handlers) |
| `createTeam`, `createUser`, `updateUser`, `deactivateUser`, `listUsers`, `inviteUser`, `acceptInvitation`, `createApiKey`, `revokeApiKey` | Standard write/read operations — `createUser`/`updateUser`/`deactivateUser` are admin-only (or self-or-admin for a user's own non-privileged fields); `listUsers` is org-scoped, no role restriction | Distribution (route handlers) |

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
```

No other context receives a raw `User`/`Team`/`Organization` row — only these summary shapes.

## Stability Guarantees

`OrganizationId`, `UserId`, `TeamId` are stable UUIDs, never reused. `getTeamChain` ordering (self-first, root-last) will not change without a major version bump — Governance's resolution correctness depends on it.

Web UI auth carries forward the current JWT approach (HS256, `sub`/`role`/`exp` claims) rather than switching to opaque server-side sessions, delivered via an httpOnly cookie instead of a client-managed header. Scoped bearer API keys remain the separate, unchanged mechanism for MCP/API access.

## Breaking Change Policy

Any change to the shapes above, or to team-chain ordering, requires updating this file in the same commit and is called out explicitly in the PR description.
