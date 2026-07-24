import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { findByOrgAndId, update, type UpdateTeamFields } from "../infrastructure/teams-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

/**
 * Updates a team's name/description/owner only — never its hierarchy
 * position (FR-004 stays a separate operation from reparenting, FR-008).
 *
 * `organizationId` is mandatory (011-tenant-isolation-rls, M1 fix): scoped
 * via `findByOrgAndId` first, throwing for a cross-org or nonexistent
 * `teamId` — CONTRACT.md already documented this function as enforcing
 * "same-organization invariants regardless of caller," but the prior
 * implementation had no such check at all and would have silently updated
 * zero rows for a cross-org id once RLS made the underlying UPDATE a no-op,
 * rather than throwing like every other function in this bounded context.
 */
export async function updateTeam(
  tx: Tx,
  organizationId: string,
  teamId: string,
  fields: UpdateTeamFields,
): Promise<void> {
  const team = await findByOrgAndId(tx, organizationId, teamId);
  if (!team) {
    throw new Error(`No team found with id "${teamId}".`);
  }
  await update(tx, teamId, fields);
}
