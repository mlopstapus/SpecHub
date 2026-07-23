---
epic: 009-billing-entitlements
feature: 003-billing-portal-and-ui
status: open
dependencies: ["002-stripe-checkout-and-subscription-sync.md"]
---

# Billing Portal & UI

The org admin-facing billing settings page — plan selection, current subscription status, Stripe-hosted billing portal link — owned by this BC per `bcs/billing-entitlements/OWNERSHIP.md` (`src/app/(app)/settings/billing`).

## Requirements

- [ ] `settings/billing` page: current plan, subscription status, seat count, "upgrade" CTA calling `createCheckoutSession`, "manage billing" link calling `createPortalSession`
- [ ] Page is hidden/no-op in self-hosted mode (billing disabled per `bcs/billing-entitlements/OWNERSHIP.md`'s self-host note) rather than showing a broken or confusing billing UI
- [ ] Admin-only access

## Acceptance Criteria

- [ ] Self-hosted install: billing settings page either doesn't appear in navigation or clearly states billing isn't applicable — no dead-end broken checkout flow
- [ ] SaaS org: upgrade flow correctly redirects to Stripe Checkout and back
- [ ] Non-admin users cannot access the page

## Open Questions

- None currently.

## Dependencies

- `002-stripe-checkout-and-subscription-sync.md`
- `backlog/004-app-shell-and-landing/EPIC.md` (this feature's UI composes into that epic's shell)

## Technical Notes

Composed into the shared app shell from `004-app-shell-and-landing/002-app-shell-and-navigation.md`, and builds its own real, finished design directly (mirroring `003-audit-compliance/003-audit-log-ui.md` and `005-governance/005-governance-views-ui.md`) rather than waiting on a later redesign pass.

**Added 2026-07-23**: no Claude design mockup exists yet for this page — pull one from claude.ai/design and run the same gap-analysis pass against `001-plan-and-entitlement-model.md`/`002-stripe-checkout-and-subscription-sync.md` before finalizing the Requirements above in more detail, the way `003-audit-compliance/003-audit-log-ui.md` did for its own schema/query items.
