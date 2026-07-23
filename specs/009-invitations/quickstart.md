# Quickstart: Invitations

Validates the feature end-to-end at the application layer (no route/UI exists yet — see plan.md/research.md §7).

## Prerequisites

- Local Postgres reachable via `DATABASE_URL`/`MIGRATION_DATABASE_URL` (or let Testcontainers provision one automatically — see below).
- `pnpm install` (pulls in the new `nodemailer` dependency).
- Migrations applied: `pnpm db:migrate` (after `pnpm db:generate` has produced this feature's migration — see tasks.md).

## Run the automated coverage

```bash
pnpm vitest run src/bcs/identity-access/application/invite-user.test.ts
pnpm vitest run src/bcs/identity-access/application/accept-invitation.test.ts
pnpm vitest run src/bcs/identity-access/application/revoke-invitation.test.ts
pnpm vitest run src/bcs/identity-access/application/list-invitations.test.ts
pnpm vitest run src/bcs/identity-access/infrastructure/schema.test.ts
pnpm vitest run src/shared/email/send-email.test.ts
```

Each spins up its own ephemeral Postgres via Testcontainers (`startTestDb()`) where DB access is needed — no manual setup beyond Docker being available, matching every other identity-access test file.

## Manual, function-level walkthrough (no HTTP layer yet)

Exercised the same way `007-user-accounts-registration`/`008-jwt-session-auth` were validated pre-route — via a throwaway script or the Vitest tests themselves — but conceptually:

1. **Invite**: `inviteUser(db, adminUser, { teamId, email: "new.hire@example.com" })` → returns `{ id, token }`. With no `SMTP_HOST` set, check the process logs for the "email delivery skipped" line containing the invite link built from `APP_BASE_URL` + the token.
2. **Duplicate rejected**: Calling `inviteUser` again with the same `teamId`'s organization and the same email → throws `DuplicateInvitationError`.
3. **Accept**: `acceptInvitation(db, token, { username: "newhire", password: "correct horse battery staple" })` → returns `{ user }` scoped to the inviting organization/team/role. Calling it again with the same token → throws `InvitationAlreadyAcceptedError`.
4. **Cross-org impossibility**: Confirm there is no parameter on `acceptInvitation` through which an organization id could be supplied — the resulting `user.orgId` always equals the invitation's own `organizationId`, sourced from the DB row alone (FR-007).
5. **List**: `listInvitations(db, adminUser)` → shows the now-`"accepted"` invitation; create and expire/revoke additional invitations to see all four `state` values represented.
6. **Revoke**: `revokeInvitation(db, adminUser, otherPendingInvitationId)` → its `state` becomes `"revoked"`; a subsequent `acceptInvitation` call with that token throws `InvitationRevokedError`.

## Expected outcomes (ties back to spec.md's Success Criteria)

- SC-001/SC-002/SC-003/SC-005 are directly exercised by steps 1–4 above.
- SC-004 (self-hosted, no email provider configured) is exercised by leaving `SMTP_HOST` unset for the whole walkthrough — every step above still completes with no error, delivery only ever logged.
