/**
 * The M3 cross-tenant-denial pattern (context/testing-strategy.md), built
 * once here in `002-identity-access` and reused by every subsequent
 * bounded-context epic's own tenant-isolation-tests feature (011-tenant-
 * isolation-rls). Asserts that fetching a resource owned by a different
 * organization is denied — never merely absent from some other, list-shaped
 * result.
 */
export async function assertCrossTenantDenied(opts: {
  actingAsOrg: string;
  resourceOwnedByOrg: string;
  fetchResourceById: (id: string) => Promise<unknown>;
  resourceId: string;
}): Promise<void> {
  let result: unknown;
  let threw = false;
  try {
    result = await opts.fetchResourceById(opts.resourceId);
  } catch {
    threw = true;
  }

  if (threw) {
    return;
  }

  if (!result) {
    return;
  }

  if (Array.isArray(result) && result.length === 0) {
    return;
  }

  throw new Error(
    `Expected cross-tenant access to resource "${opts.resourceId}" ` +
      `(owned by organization "${opts.resourceOwnedByOrg}") to be denied ` +
      `when acting as organization "${opts.actingAsOrg}", but it resolved ` +
      `a truthy value instead of throwing or resolving empty.`,
  );
}
