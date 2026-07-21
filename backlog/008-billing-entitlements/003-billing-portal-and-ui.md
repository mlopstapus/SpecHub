---
epic: 008-billing-entitlements
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

## Technical Notes

Composed into the app shell owned by Distribution (epic 007), same pattern as the audit log UI in epic 003.
