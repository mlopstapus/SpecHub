---
epic: 008-billing-entitlements
feature: 002-stripe-checkout-and-subscription-sync
status: open
dependencies: ["001-plan-and-entitlement-model.md", "backlog/000-foundations/005-deployment-environments-and-aws-topology.md"]
---

# Stripe Checkout & Subscription Sync

Implement Stripe integration as an anti-corruption layer — the only place in the codebase that imports the Stripe SDK, per `bcs/billing-entitlements/CONTRACT.md`'s Breaking Change Policy. Seat-based billing per the architecture session's confirmed pricing model.

## Requirements

- [ ] `createCheckoutSession(orgId, planId)`: creates a Stripe Checkout session, seat-based pricing, returns a hosted checkout URL
- [ ] `billing.subscriptions` table: `id`, `organization_id`, `stripe_subscription_id`, `stripe_customer_id`, `status`, `current_period_end`, `seat_count`
- [ ] `handleStripeWebhook(event)`: verifies Stripe signature, translates `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` into local state changes on `billing.subscriptions` and `billing.entitlements`
- [ ] `SubscriptionCreated`/`SubscriptionUpdated`/`SubscriptionCanceled` events per `bcs/billing-entitlements/CONTRACT.md`, consumed by Audit
- [ ] No other bounded context imports the Stripe SDK or holds a Stripe API key — enforced by the module-boundary lint (extend the epic-001 rule to cover this specific case if not already general enough)

## Acceptance Criteria

- [ ] A completed Stripe Checkout session correctly provisions/updates the org's `billing.subscriptions` row and `billing.entitlements` overrides
- [ ] A canceled subscription correctly reverts the org's entitlements to Free defaults
- [ ] Webhook signature verification rejects unsigned/forged webhook payloads
- [ ] A simulated Stripe outage does not affect `resolveEntitlements()` (already covered by feature 001's test, re-verified here against the real Stripe integration)

## Open Questions

- None — seat-based Stripe billing is a well-trodden integration pattern; no open design questions beyond implementation details.

## Dependencies

- `001-plan-and-entitlement-model.md`
- `backlog/000-foundations/005-deployment-environments-and-aws-topology.md` (needs a real deployed webhook URL to register with Stripe)

## Technical Notes

Per `bcs/billing-entitlements/CONTRACT.md`'s Breaking Change Policy: "No other context may import the Stripe SDK or hold a Stripe API key. Any new integration touching billing goes through this BC." This is the anti-corruption-layer boundary named in the architecture's context map — worth a deliberate code-review check, not just a lint rule, since Stripe's SDK shapes are easy to leak into calling code accidentally via type inference.
