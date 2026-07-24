import {
  hasEntitlement as hasBillingEntitlement,
  type EntitlementKey,
} from "@/bcs/billing-entitlements";
import {
  authenticateSession as authenticateIdentitySession,
  type AppSessionUser,
} from "@/bcs/identity-access";
import { authDb } from "@/shared/db";

type AccessDependencies = {
  authenticateSession(
    cookieHeader: string | null | undefined,
  ): Promise<AppSessionUser | null>;
  hasEntitlement(orgId: string, key: EntitlementKey): Promise<boolean>;
};

export type AppShellAccess =
  | { status: "unauthenticated" }
  | { status: "entitlement-denied"; user: AppSessionUser }
  | { status: "allowed"; user: AppSessionUser };

const productionDependencies: AccessDependencies = {
  authenticateSession: (cookieHeader) =>
    authenticateIdentitySession(authDb, cookieHeader),
  hasEntitlement: hasBillingEntitlement,
};

export async function resolveAppShellAccess(
  cookieHeader: string | null | undefined,
  dependencies: AccessDependencies = productionDependencies,
): Promise<AppShellAccess> {
  const user = await dependencies.authenticateSession(cookieHeader);
  if (!user) {
    return { status: "unauthenticated" };
  }
  const enabled = await dependencies.hasEntitlement(
    user.orgId,
    "coreFeaturesEnabled",
  );
  return enabled
    ? { status: "allowed", user }
    : { status: "entitlement-denied", user };
}
