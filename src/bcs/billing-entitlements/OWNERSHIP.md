# Billing & Entitlements — Ownership

**Owner:** Ben Anderson

## Folder Ownership

| Path | Ownership level |
|---|---|
| `/bcs/billing-entitlements/` | Full |
| `src/bcs/billing-entitlements/` | Full |
| `src/app/api/webhooks/stripe` | Full |
| `src/app/(app)/settings/billing` (UI) | Full |

## Database Ownership

Postgres schema: `billing`

| Schema / Table | Notes |
|---|---|
| `billing.plans` | Seed data: `free`, `paid` — not tenant-scoped |
| `billing.subscriptions` | One per org (paid orgs only); mirrors Stripe subscription id/status/period |
| `billing.entitlements` | One per org; plan defaults merged with `overrides` jsonb column |

## Shared Resource Ownership

None.

## Dependencies (owned by others)

| Resource | Owned by BC |
|---|---|
| `OrganizationCreated` event | Identity & Access |
| Org existence checks | Identity & Access |

## Note on self-hosted (Free tier) installs

Self-hosted deployments never talk to Stripe — the app runs with `STRIPE_ENABLED=false`, `resolveEntitlements()` always returns the hardcoded Free defaults for the single local org, and the checkout/portal/webhook endpoints are no-ops. This keeps self-hosters from ever needing a Stripe account, while running the exact same code path as the managed SaaS.
