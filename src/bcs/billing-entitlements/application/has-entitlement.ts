import type { EntitlementKey } from "../domain/entitlement";
import { resolveEntitlements } from "./resolve-entitlements";

export async function hasEntitlement(
  orgId: string,
  key: EntitlementKey,
): Promise<boolean> {
  const value = (await resolveEntitlements(orgId))[key];
  if (value === null) {
    return true;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return value > 0;
}
