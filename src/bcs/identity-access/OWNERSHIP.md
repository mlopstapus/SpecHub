# Identity & Access — Ownership

**Owner:** Ben Anderson

## Folder Ownership

| Path | Ownership level |
|---|---|
| `/bcs/identity-access/` | Full |
| `src/bcs/identity-access/` (application services, domain model) | Full |
| `src/app/(auth)/login`, `/register`, `/invite/[token]`, `/settings/*` (org/team/member UI) | Full |

## Database Ownership

Postgres schema: `identity_access`

| Schema / Table | Notes |
|---|---|
| `identity_access.organizations` | Tenant root. `plan_id` and `stripe_customer_id` are foreign-key pointers into Billing's schema — Identity stores the pointer, Billing owns the meaning |
| `identity_access.teams` | Recursive hierarchy, scoped to one organization |
| `identity_access.users` | `(organization_id, email)` and `(organization_id, username)` unique — **not globally unique**, corrected from the current single-tenant schema |
| `identity_access.invitations` | Token-based, org + team scoped |
| `identity_access.api_keys` | Hashed at rest, belongs to a user |

## Shared Resource Ownership

None. Cross-cutting infra (DB client, UI kit, config loading) is claimed by Distribution — see [`bcs/distribution/OWNERSHIP.md`](../distribution/OWNERSHIP.md).

## Dependencies (owned by others)

| Resource | Owned by BC |
|---|---|
| `plan_id` meaning, entitlement resolution | Billing & Entitlements |
| Audit trail for identity mutations | Audit & Compliance |
