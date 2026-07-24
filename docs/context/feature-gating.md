# Feature Gating & Flags

**Status:** Decided
**Decided:** 2026-07-21
**Backlog item:** `backlog/000-foundations/009-feature-gating-and-flags.md`
**Implements:** tenet G1 (`spec/tenets.md`)

## The gate primitive

One function, owned by Billing & Entitlements (not `shared/` — it has an obvious owning BC per `context/repo-structure.md`), added to its contract:

```ts
// bcs/billing-entitlements — exposed via its index.ts barrel
requireEntitlement(orgId: OrganizationId, key: EntitlementKey): Promise<void>; // throws DomainError("ENTITLEMENT_REQUIRED") if denied
hasEntitlement(orgId: OrganizationId, key: EntitlementKey): Promise<boolean>;  // non-throwing check, for UI branching
```

Both read from the same `resolveEntitlements(orgId)` snapshot already defined in the BC's contract — no new Stripe/network calls, no new state. `requireEntitlement` is for enforcement points (route/tool handlers); `hasEntitlement` is for UI code deciding what to render.

Boolean keys (`ssoEnabled`, `customBranding`) gate on truthiness. Numeric/limit keys (`maxTeams`, `maxApiKeys`, `seatLimit`) gate via a companion `requireUnderLimit(orgId, key, currentCount)` on the same contract, since "is this feature available" and "has this org hit its cap" are different checks against the same entitlement row.

## Enforcement per transport

Every feature is gated at its actual entry point — REST route handler, MCP tool handler, and (separately, non-authoritatively) the UI:

| Transport | Where the check runs | On denial |
|---|---|---|
| REST | Start of the route handler, before calling into the owning BC's application service | `DomainError("ENTITLEMENT_REQUIRED", ...)` → mapped by Distribution's existing error mapper (`context/api-conventions.md`) |
| MCP | Start of the tool handler, same call | Same `DomainError`, mapped to the MCP tool's error response |
| UI | `hasEntitlement()` (non-throwing) controls whether a surface renders, is disabled, or shows an upsell | Never the only enforcement — UI-layer gating is a UX nicety, not a security boundary; the server-side `requireEntitlement()` call is what actually protects the feature, consistent with the general "app layer is the primary control" pattern used for tenant isolation (`context/database-conventions.md`) |

This mirrors the same "one shared mapper, checked consistently on every transport" shape already established for `DomainError` in `context/api-conventions.md` — deliberately, so a contributor who already knows that pattern doesn't have to learn a second one for entitlements.

## Denied-gate error convention

Extends the existing status code table in `context/api-conventions.md`:

| `DomainError.code` | HTTP status |
|---|---|
| `ENTITLEMENT_REQUIRED` (boolean flag off) | 403 |
| `ENTITLEMENT_LIMIT_REACHED` (numeric cap hit) | 402 if it's a natural upsell moment (e.g. "add a team"), 403 if it's a hard cap with no self-serve upgrade path |

Both codes flow through the same logging schema (`context/api-conventions.md`'s logging section) with `code` set, making "how often do we hit an entitlement wall" a log query rather than something that needs its own instrumentation.

## Convention: every feature names its gate

Every new REST route or MCP tool's implementation includes a `requireEntitlement`/`requireUnderLimit` call as part of its handler — including features available to everyone, which are gated on a key that defaults to `true`/unlimited for both tiers (e.g. core prompt CRUD gates on a `coreFeaturesEnabled` key that's `true` everywhere). This keeps the pattern universal rather than opt-in: a reviewer checking a new route for a gate call sees either a real tier check or an explicit "yes, this is for everyone" marker — never an unexplained absence that could be an oversight. PR review for any new route/tool checks for this call, the same way `context/database-conventions.md`'s RLS pattern is checked for any new tenant-scoped table.

## Scope: non-billing flags are explicitly out of scope

This mechanism is for tier-driven gating only. A kill switch or staged-rollout flag unrelated to billing (e.g. "disable the new workflow engine for everyone if it's misbehaving") is a **separate, deliberately deferred concern** — reusing `applyEntitlementOverride` for that would conflate "what a customer pays for" with "what's currently safe to ship," two different lifecycles with different owners (product/billing vs. on-call/engineering). Build a dedicated flag system only when a concrete kill-switch/rollout need arises, not speculatively now.

## Deliverable status

Gate primitive, per-transport enforcement, error convention, and the "every feature names its gate" review expectation are settled. `context/entitlements.md` is the source of truth for which keys exist; this document is the source of truth for how any feature actually checks them.
