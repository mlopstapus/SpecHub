---
epic: 002-identity-access
feature: 003-user-accounts-and-registration
status: open
dependencies: ["001-organization-tenant-model.md", "002-team-hierarchy.md"]
---

# User Accounts & Registration

Port `User` from the current Python `models.py`/`user_service.py`, correcting the uniqueness constraints from global to org-scoped — the specific multi-tenancy bug PDR-003 exists to prevent (two different orgs both wanting a user named "admin").

## Requirements

- [ ] `identity_access.users` table: `id`, `organization_id`, `team_id`, `username`, `display_name`, `email`, `password_hash` (nullable), `role`, `is_active`, timestamps
- [ ] `(organization_id, email)` and `(organization_id, username)` unique constraints — **not globally unique**, correcting the current schema
- [ ] CRUD: create user (admin-only), update user, deactivate user, list users by team/org
- [ ] Password hashing via bcrypt, matching tenet S1 (secrets hashed at rest, never stored reversibly)

## Acceptance Criteria

- [ ] Two different organizations can each have a user with email `admin@example.com` with no conflict — verified by test
- [ ] Within one organization, a second user with the same email is rejected
- [ ] `password_hash` is never returned in any API response shape, verified by a test asserting the response schema excludes it

## Open Questions

- None currently.

## Dependencies

- `001-organization-tenant-model.md`
- `002-team-hierarchy.md` (every user belongs to a team)

## Technical Notes

Per `bcs/identity-access/CONTRACT.md`, other contexts only ever receive the `UserSummary` shape (`id`, `orgId`, `teamId`, `role`, `email`) — never the raw row, never `password_hash`. Per tenet S1, this feature is where the hashing pattern gets locked in for the new codebase, not just carried forward informally.
