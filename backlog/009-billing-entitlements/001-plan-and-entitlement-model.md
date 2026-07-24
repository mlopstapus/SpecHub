---
epic: 009-billing-entitlements
feature: 001-plan-and-entitlement-model
status: open
dependencies: ["backlog/002-identity-access/001-organization-tenant-model.md", "backlog/000-foundations/007-entitlement-catalog.md"]
---

# Plan & Entitlement Model

Implement `Plan` and `Entitlement` per `bcs/billing-entitlements/CONTRACT.md` and PDR-004 — the data-driven, per-org flag/limit system that replaces a hardcoded tier enum.

## Requirements

- [ ] `billing.plans` table (seed data, not tenant-scoped): `id`, `name`, default entitlement values (jsonb)
- [ ] `billing.entitlements` table: `id`, `organization_id` (unique — one row per org), `overrides` (jsonb), resolved value = plan defaults merged with overrides
- [ ] `resolveEntitlements(orgId)`: pure local read (no network call), returns the merged `Entitlement` shape from `context/entitlements.md`'s finalized key catalog
- [ ] `applyEntitlementOverride(orgId, overrides)`: admin-only, produces an `EntitlementOverrideApplied` audit event
- [ ] Self-hosted mode: `resolveEntitlements()` always returns hardcoded Free defaults, no DB dependency on `billing.entitlements` at all (per `bcs/billing-entitlements/OWNERSHIP.md`'s self-host note)
- [ ] `OrganizationCreated` event handler: provisions a default `Free`-plan entitlement row for every new org (SaaS mode only)

## Acceptance Criteria

- [ ] `resolveEntitlements()` for a SaaS org reflects plan defaults correctly when no overrides exist
- [ ] `resolveEntitlements()` for a SaaS org with an override correctly reflects the overridden value, plan default for everything else
- [ ] `resolveEntitlements()` never issues a network call — verified by a test that fails if Stripe is unreachable and confirms the call still succeeds
- [ ] Self-hosted mode's `resolveEntitlements()` never queries `billing.entitlements` at all

## Open Questions

- None — entitlement keys and defaults come from `context/entitlements.md`.

## Dependencies

- `backlog/002-identity-access/001-organization-tenant-model.md`
- `backlog/000-foundations/007-entitlement-catalog.md`

## Technical Notes

Directly implements PDR-004's core design goal: adding a new entitlement key or changing a default is a data change to `billing.plans`, not a code change scattered across consuming BCs.
