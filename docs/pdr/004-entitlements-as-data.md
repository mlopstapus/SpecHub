# PDR-004: Entitlements as Per-Org Data, Not a Hardcoded Tier Enum

**Status:** Accepted
**Date:** 2026-07-20

## Context

The product has Free and Paid planes, with "Enterprise" explicitly described as "SaaS plus whatever a specific deal needs" rather than a fixed second feature set — tier boundaries are not locked in and are expected to keep moving. A hardcoded `if (org.tier === "enterprise")` pattern scattered across contexts would need a code change and deploy every time a pricing/packaging decision changes, and can't represent "this one customer gets SSO early as part of a negotiated deal" without a special case.

## Options Considered

### Hardcoded tier enum with switch statements at call sites
`plan: "free" | "paid" | "enterprise"`, checked inline wherever a feature is gated.
Pros: simplest to write initially, obvious at each call site.
Cons: every packaging change is a code change; no way to represent a one-off custom deal without adding another enum value or a bypass hack; gating logic duplicates across contexts.

### Third-party feature flag service (LaunchDarkly etc.)
Pros: mature tooling, gradual rollouts, targeting rules.
Cons: this is entitlement/billing logic, not experimentation — pulling in an external service and a network dependency for something that should be a fast local read is the wrong tool, and it's a Build vs Buy mismatch (see architecture.md's Build vs Buy table).

### Data-driven Entitlement record per org (Plan defaults + overrides)
A `billing.entitlements` row per org: flags/limits resolved from the org's plan, with an `overrides` jsonb column for per-org exceptions.

## Decision

Data-driven entitlements, owned entirely by the Billing & Entitlements bounded context. Every other context calls `resolveEntitlements(orgId)` — a local, non-network read — instead of checking a plan enum.

## Consequences

- **Positive:** packaging changes (new flag, new limit, one customer's custom deal) are data changes, not deploys; every consuming context has one call site instead of scattered tier checks; naturally supports "Enterprise is just Paid plus some flags" without a second code path.
- **Negative:** slightly more indirection than an inline enum check; requires discipline to always add new gated behavior as an entitlement key rather than a fresh ad hoc flag.
- **Risks:** entitlement key sprawl over time with no clear ownership of what each key means. Mitigation: entitlement keys and their meaning are documented in `bcs/billing-entitlements/CONTRACT.md`'s data contract, kept as the single source of truth.
