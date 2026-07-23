import { EntitlementRequiredError } from "../domain/user";

/**
 * Temporary stand-in for `billing-entitlements`' future
 * `requireEntitlement(orgId, "coreFeaturesEnabled")` (tenet G1, research.md
 * §4) — that bounded context has no implementation yet (epic 008 not
 * started). `coreFeaturesEnabled` defaults to `true` for both Free and Paid
 * tiers (context/entitlements.md), so this hardcodes that same value rather
 * than skipping the gate call entirely. Swap for a real call once epic 008
 * lands (tracked in
 * backlog/008-billing-entitlements/004-entitlement-enforcement-integration.md).
 *
 * `enabled` is a parameter (defaulting to the hardcoded stand-in) purely so
 * this function's fail-closed branch is testable — every real call site
 * calls `assertCoreFeaturesEnabled()` with no argument.
 */
const CORE_FEATURES_ENABLED = true;

export function assertCoreFeaturesEnabled(
  enabled: boolean = CORE_FEATURES_ENABLED,
): void {
  if (!enabled) {
    throw new EntitlementRequiredError("coreFeaturesEnabled");
  }
}
