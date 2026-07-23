# Data Model: Invitations

## `identity_access.invitations`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid`, PK, default random | Standard (`shared/db/columns.ts`'s `id()`) |
| `organization_id` | `uuid`, not null | Standard (`organizationId()`); no FK, matching every other `organization_id` column in this codebase (`CLAUDE.md`) |
| `team_id` | `uuid`, not null | FK → `identity_access.teams.id` |
| `email` | `text`, not null | Lowercased by the application layer before storage/comparison (mirrors `users.email`'s convention) |
| `role` | `text` enum (`"admin" \| "member"`), not null, default `"member"` | The role the resulting account will be created with on acceptance |
| `token` | `text`, not null, **unique** | 32 bytes of CSPRNG output, base64url-encoded (research.md §2) |
| `invited_by_id` | `uuid`, not null | FK → `identity_access.users.id` — who created the invitation |
| `accepted_at` | `timestamptz`, nullable | Set once, by the conditional accept update (research.md §6); never unset |
| `revoked_at` | `timestamptz`, nullable | New column (not in the legacy schema) — set by `revokeInvitation`; never unset |
| `expires_at` | `timestamptz`, not null | `created_at + INVITATION_EXPIRY_HOURS` (default 168h / 7 days) at insert time |
| `created_at` / `updated_at` | `timestamptz`, not null, default `now()` | Standard (`timestamps()`) |

**Index**: `(organization_id, email)`, non-unique — supports the duplicate-pending-invite and listing queries. Not a unique constraint: multiple *historical* (expired/accepted/revoked) invitations for the same email in the same org must coexist; only application-layer logic (research.md §8) enforces "at most one *active* pending invitation" at insert time.

**No RLS policy** on this table yet — same deferral `identity_access.teams`/`users` already carry (plan.md's Complexity Tracking).

## Derived state (not a column)

```ts
type InvitationState = "pending" | "accepted" | "expired" | "revoked";

function deriveInvitationState(row: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date): InvitationState {
  if (row.revokedAt !== null) return "revoked";
  if (row.acceptedAt !== null) return "accepted";
  if (row.expiresAt <= now) return "expired";
  return "pending";
}
```

Precedence is fixed and mutually exclusive: `revoked` is checked first (an invitation can be revoked at any point before acceptance, including after it has technically expired — the state should reflect the deliberate admin/owner action, not the clock), then `accepted`, then the `expires_at` comparison, defaulting to `pending`.

## TypeScript shapes (`domain/invitation.ts`)

```ts
export type InvitationRole = "admin" | "member";
export type InvitationState = "pending" | "accepted" | "expired" | "revoked";

export interface Invitation {
  id: string;
  organizationId: string;
  teamId: string;
  email: string;
  role: InvitationRole;
  token: string;
  invitedById: string;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** FR-011's list shape — no `token` field (never returned in a listing; only delivered via the invite email itself). */
export interface InvitationSummary {
  id: string;
  email: string;
  teamId: string;
  role: InvitationRole;
  state: InvitationState;
  createdAt: Date;
}
```

## Error classes (`domain/invitation.ts`)

| Class | Thrown when |
|---|---|
| `DuplicateInvitationError` | An active (pending, unexpired, unrevoked) invitation already exists for this `(organizationId, email)` (FR-003) |
| `InvalidInvitationTokenError` | `acceptInvitation` is called with a token matching no row at all |
| `InvitationExpiredError` | `deriveInvitationState(...) === "expired"` at accept time |
| `InvitationAlreadyAcceptedError` | `deriveInvitationState(...) === "accepted"` at accept time, **or** `revokeInvitation` is called on an already-accepted invitation |
| `InvitationRevokedError` | `deriveInvitationState(...) === "revoked"` at accept time |
| `InvitationNotFoundError` | `revokeInvitation` is called with an id matching no row in the caller's organization |

Reused from `domain/user.ts` (not redeclared): `DuplicateUserError`, `InvalidTeamAssignmentError`, `NotAuthorizedError`, `WeakPasswordError` (the last two surface transitively through `insertValidatedUser` during acceptance).

## Relationships

- `invitations.team_id` → `teams.id`, no `ON DELETE` cascade/set-null (no precedent for cascading deletes in this schema). **Discovered while implementing acceptance's tests**: this FK is stronger than spec.md's edge case originally assumed — Postgres refuses to delete a team at all while *any* invitation (pending, accepted, expired, or revoked) still references it, so "the invitation's team was deleted before acceptance" cannot actually occur once an invitation exists, rather than being a case acceptance must detect and reject at runtime. `insertValidatedUser`'s own team-existence check (reused by `acceptInvitation`, surfacing `InvalidTeamAssignmentError`) is retained as a defensive check inherited from that shared core — relevant to its other caller (`createUser`, a genuine typo'd `teamId`), not reachable via this specific path.
- `invitations.invited_by_id` → `users.id`: who created it, for audit/display purposes.
- `invitations.organization_id`: the tenant boundary; never derived from `team_id` at read time (both are stored directly, matching `users`' own pattern of storing both `organization_id` and `team_id` rather than deriving one from the other).
