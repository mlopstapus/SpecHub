import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createOrganization } from "./create-organization";
import type { InsertOrganizationParams } from "../infrastructure/organizations-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

export type ProvisionTeamAndAdmin = (
  tx: Tx,
  organizationId: string,
) => Promise<{ teamId: string; userId: string }>;

/**
 * Creates the Organization row and runs `provisionTeamAndAdmin` in the same
 * transaction (FR-004) — if the callback throws, the Organization insert
 * rolls back too. `provisionTeamAndAdmin` is a composability seam: neither
 * `identity_access.teams` nor `identity_access.users` exists yet (those
 * tables belong to features 002/003, which depend on this feature rather
 * than the reverse — research.md §2). This feature's own tests supply a
 * stub; the real callback lands once those features exist.
 */
export async function bootstrapOrganization(
  db: PostgresJsDatabase<Record<string, never>>,
  params: InsertOrganizationParams,
  provisionTeamAndAdmin: ProvisionTeamAndAdmin,
): Promise<{ organizationId: string; teamId: string; userId: string }> {
  return db.transaction(async (tx) => {
    const { id: organizationId } = await createOrganization(tx, params);
    const { teamId, userId } = await provisionTeamAndAdmin(tx, organizationId);
    return { organizationId, teamId, userId };
  });
}
