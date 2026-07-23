# Billing & Entitlements — Contract

**Owner:** Ben Anderson
**Status:** Draft

## Purpose

The only context that talks to Stripe. Owns `Subscription` (mirrored Stripe state), `Plan` (seed data: Free, Paid), and `Entitlement` — a flexible, per-organization set of feature flags and limits computed from the org's plan defaults plus any explicit overrides. This is the mechanism for "SaaS and Enterprise are the same product with different flags turned on" rather than hardcoded tier branching — deliberately chosen because tier boundaries are not locked in yet and will keep moving.

## Exposed APIs

| Endpoint / Method | Description | Consumers |
|---|---|---|
| `resolveEntitlements(orgId)` | Returns the current flag/limit snapshot for an org, read from local mirrored state (never calls Stripe live) | Identity & Access, Governance, Prompt Registry, Workflow Orchestration, Audit & Compliance, Distribution |
| `getSubscriptionStatus(orgId)` | active / past_due / canceled | Distribution (billing UI) |
| `createCheckoutSession(orgId, planId)`, `createPortalSession(orgId)` | Stripe-hosted checkout/billing portal URLs | Distribution |
| `applyEntitlementOverride(orgId, overrides)` | Manual override for a custom deal (the "Enterprise" lever) | Distribution (admin-only route) |
| `handleStripeWebhook(event)` | Anti-corruption boundary — translates raw Stripe events into this BC's own state changes | Stripe (inbound webhook) |

## Events Published

| Event | Payload summary | Consumers |
|---|---|---|
| `SubscriptionCreated` / `SubscriptionUpdated` / `SubscriptionCanceled` | orgId, planId, status | Audit, Identity & Access (no action required, informational) |
| `EntitlementOverrideApplied` | orgId, overriddenKeys, actorUserId | Audit |

## Events Consumed

| Event | From BC | What this BC does with it |
|---|---|---|
| `OrganizationCreated` | Identity & Access | Provisions a default `Free` plan + entitlement row so every org has a resolvable entitlement snapshot from creation |

## Data Contracts

```ts
interface Entitlement {
  orgId: string;
  ssoEnabled: boolean;
  maxTeams: number | null;        // null = unlimited
  maxApiKeys: number | null;
  auditRetentionDays: number;     // e.g. 7 free, 90 paid, overridable
  prioritySupport: boolean;
  seatLimit: number | null;
  [key: string]: unknown;         // deliberately open — new flags don't require a schema migration to the *consumers*, only to this BC's default table
}
```

## Stability Guarantees

`resolveEntitlements()` never makes a network call — it's a local read, so it stays fast and available even if Stripe is down. New entitlement keys can be added without breaking existing consumers (they default to a safe value); removing a key consumers rely on requires a PDR.

## Breaking Change Policy

No other context may import the Stripe SDK or hold a Stripe API key. Any new integration touching billing goes through this BC.
