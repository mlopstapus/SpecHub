# Contract: Identity & Access — Invitations

Adds four functions to `identity-access`'s existing exposed API surface (`bcs/identity-access/CONTRACT.md` already lists `inviteUser`/`acceptInvitation` in its table as forward-looking entries; `revokeInvitation`/`listInvitations` are new additions this feature contributes to that same table).

## `inviteUser(db, actingUser, params): Promise<{ id: string; token: string }>`

```ts
interface InviteUserParams {
  teamId: string;
  email: string;
  role?: "admin" | "member"; // default "member"
}
```

- Authorization: `actingUser.role === "admin"` OR `actingUser.id === team.ownerId` for the target team. Otherwise throws `NotAuthorizedError`.
- Throws `InvalidTeamAssignmentError` if `teamId` doesn't resolve to a team in `actingUser.orgId`.
- Throws `DuplicateInvitationError` if an active invitation already exists for `(actingUser.orgId, email)`.
- Throws `DuplicateUserError` if an active user already exists for `(actingUser.orgId, email)`.
- On success: inserts the row, records an audit event (`invitation.created`), attempts email delivery best-effort (never throws from the email step), and returns the new invitation's `id` and raw `token` (the only place the raw token is ever returned — never again after this call, and never included in `listInvitations`' output).

## `acceptInvitation(db, token, params): Promise<{ user: UserSummary }>`

```ts
interface AcceptInvitationParams {
  username: string;
  password: string;
  displayName?: string;
}
```

- Throws `InvalidInvitationTokenError` if no invitation matches `token`.
- Throws `InvitationExpiredError` / `InvitationAlreadyAcceptedError` / `InvitationRevokedError` matching the invitation's derived state.
- Throws `InvalidTeamAssignmentError` if the invitation's `teamId` no longer resolves to a team in the invitation's own organization (e.g. the team was deleted).
- Throws `WeakPasswordError` / `DuplicateUserError` transitively from `insertValidatedUser` (username/password validation, org+username or org+email collision).
- On success: atomically (single transaction) marks the invitation accepted (conditional update, research.md §6), creates the user scoped to `invitation.organizationId`/`invitation.teamId`/`invitation.role`, records an audit event (`invitation.accepted`), and returns the new user's `UserSummary`.

## `revokeInvitation(db, actingUser, invitationId): Promise<void>`

- Authorization: same admin-or-team-owner rule as `inviteUser`, checked against the invitation's own `teamId`.
- Throws `InvitationNotFoundError` if no invitation with this id exists in `actingUser.orgId`.
- Throws `InvitationAlreadyAcceptedError` if the invitation has already been accepted.
- No-ops (no error, no audit event) if the invitation is already revoked — idempotent.
- On success: sets `revoked_at`, records an audit event (`invitation.revoked`).

## `listInvitations(db, actingUser): Promise<InvitationSummary[]>`

- Admin-only: throws `NotAuthorizedError` for a non-admin caller.
- Returns every invitation in `actingUser.orgId`, each with its derived `state`, newest first. Never includes `token`.

## Error → typical caller mapping

None of these errors are mapped to HTTP status codes by this feature (no route exists yet) — that mapping is Distribution's future responsibility via `context/api-conventions.md`'s `DomainError` conventions, the same deferral `007-user-accounts-registration`/`008-jwt-session-auth` already left for their own error classes.
