# Entitlement Catalog

**Status:** Decided (values provisional — see note)
**Decided:** 2026-07-21
**Backlog item:** `backlog/000-foundations/007-entitlement-catalog.md`

> **Note on the values below:** the key *list* and which-keys-are-override-candidates calls are engineering decisions and are settled. The specific Free/Paid *numbers* are pricing/packaging decisions this document proposes a reasonable starting point for for launch — they're the easiest part of this system to change later (per PDR-004, entitlements are per-org data, not a hardcoded enum), so treat them as a starting point to revise once real usage/pricing signal exists, not a permanent commitment.

## Entitlement keys

| Key | Type | Free default | Paid default | Override candidate? |
|---|---|---|---|---|
| `maxTeams` | `number \| null` | `null` (unlimited) | `null` (unlimited) | No — self-hosters run their own infra, a limit here doesn't protect anything; Paid's value isn't feature-gating team count |
| `maxApiKeys` | `number \| null` | `5` | `25` | Yes — some orgs legitimately need many CI/integration keys |
| `maxProjects` | `number \| null` | `null` (unlimited) | `null` (unlimited) | No — same reasoning as `maxTeams` |
| `maxPromptVersionHistory` | `number \| null` | `20` versions per prompt | `null` (unlimited) | No |
| `ssoEnabled` | `boolean` | `false` | `false` | **Yes — primary Enterprise lever** |
| `auditRetentionDays` | `number` | `7` | `90` | **Yes — primary Enterprise lever** (Enterprise compliance deals routinely need 1yr+) |
| `prioritySupport` | `boolean` | `false` | `true` | No |
| `seatLimit` | `number \| null` | `null` (unlimited — self-host has no billing concept of seats) | Tied to Stripe subscription quantity (see below) | N/A — driven by subscription, not a flat override |
| `customBranding` | `boolean` | `false` | `false` | Yes — plausible Enterprise ask (white-label) |
| `coreFeaturesEnabled` | `boolean` | `true` | `true` | No — the universal gate per tenet G1; not a real tier lever, just the explicit "this feature is for everyone" marker so core prompt/governance/workflow CRUD still names a gate like every other feature does |

## Rationale

Free tier is kept generous on anything that doesn't cost the maintainer money or reflect real infrastructure risk (`maxTeams`, `maxProjects` unlimited) — self-hosters running their own Postgres instance aren't a cost center to gate, and artificial limits there would only generate OSS ill-will without protecting anything real. Paid's value proposition is concentrated on what actually requires the maintainer's infrastructure or ongoing work: **not running your own infra** (the SaaS itself), longer audit retention (a real storage/compliance cost), SSO (real integration engineering cost), and support responsiveness — not raw feature-gating of the core prompt-registry/governance functionality both tiers share.

## Seat-based billing interaction

`seatLimit` on a Paid org is set from `subscription.quantity` on the mirrored Stripe subscription (`billing.subscriptions`) at webhook-sync time — it is not set directly via `applyEntitlementOverride` in the normal flow; a quantity change on Stripe's side (customer adds seats in the billing portal) flows through `handleStripeWebhook` → updates `billing.entitlements.seatLimit` to match. An `applyEntitlementOverride` on `seatLimit` is reserved for a manual custom-deal exception (e.g. a negotiated seat count outside the standard Stripe quantity flow).

## Override mechanism

Per PDR-004 / the `billing-entitlements` contract, `applyEntitlementOverride(orgId, overrides)` is the "Enterprise is Paid plus overrides" lever — an admin-only Distribution route, and every call publishes `EntitlementOverrideApplied` to the audit log (tenet C1). The keys marked "override candidate" above are the ones expected to actually see this call in practice; the others are listed as "No" because a request to override them likely signals a pricing-model gap worth addressing generally, not a one-off override.

## Gating mechanism

This document defines *which keys exist and their default values*. It does not define how a feature actually checks one — that's `context/feature-gating.md` (tenet G1: every feature ships behind a checked entitlement flag, via `requireEntitlement`/`hasEntitlement`/`requireUnderLimit` on this BC's contract). Adding a key here without a corresponding gate call in the feature that needs it is exactly the gap G1 exists to prevent.

## Deliverable status

Key list, Free/Paid defaults, and override-candidate flags are recorded. This unblocks `009-billing-entitlements`'s schema (the entitlement table needs to know the key shape even though the numeric defaults may still move before general availability), and is the key catalog `context/feature-gating.md`'s gate primitive checks against.
