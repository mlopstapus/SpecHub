import {
  FREE_ENTITLEMENTS,
  type EntitlementSnapshot,
} from "../domain/entitlement";

export { FREE_ENTITLEMENTS };

/**
 * Provisional local resolver. Self-hosted installs permanently use this Free
 * snapshot; Billing feature 004 will replace the SaaS source with plan defaults
 * plus per-org overrides without changing this public signature.
 */
export async function resolveEntitlements(
  _orgId: string,
): Promise<Readonly<EntitlementSnapshot>> {
  return Object.freeze({ ...FREE_ENTITLEMENTS });
}
