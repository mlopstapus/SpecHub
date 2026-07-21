---
epic: 002-identity-access
feature: 005-invitations
status: open
dependencies: ["003-user-accounts-and-registration.md", "backlog/000-foundations/008-third-party-services.md"]
---

# Invitations

Port the invitation flow from the current Python `invitation_service.py` — inviting a user to an organization's team by email, token-based acceptance. Now needs to send actual email (the current Python implementation's email-sending story should be checked — if it's stubbed, this feature also closes that gap using the provider decided in the third-party-services foundations item).

## Requirements

- [ ] `identity_access.invitations` table: `id`, `organization_id`, `team_id`, `email`, `role`, `token` (unique), `invited_by_id`, `accepted_at` (nullable), `expires_at`, `created_at`
- [ ] Create invitation: generates a token, sends an email via the chosen provider (or logs to console in local dev if email isn't configured — self-host shouldn't hard-fail without SMTP set up)
- [ ] Accept invitation: validates token + expiry, creates the `User` scoped to the invitation's organization/team, marks `accepted_at`
- [ ] Expired or already-accepted tokens are rejected with a clear error

## Acceptance Criteria

- [ ] Creating an invitation and accepting it with a valid token creates a user correctly scoped to the inviting org/team
- [ ] An expired token is rejected
- [ ] A token from organization A cannot be used to join organization B (should be structurally impossible, not just checked — the token encodes/resolves to one org)

## Open Questions

- Does invitation creation require the email provider to be configured, or degrade gracefully (log the invite link) for self-hosted installs without SMTP set up?

## Dependencies

- `003-user-accounts-and-registration.md`
- `backlog/000-foundations/008-third-party-services.md`

## Technical Notes

Per tenet M1, `token` resolves to exactly one organization — this feature must not allow an invitation created for org A to be redeemable in a way that lands the new user in org B.
