import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { update, type UpdateTeamFields } from "../infrastructure/teams-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

/**
 * Updates a team's name/description/owner only — never its hierarchy
 * position (FR-004 stays a separate operation from reparenting, FR-008).
 */
export async function updateTeam(
  tx: Tx,
  teamId: string,
  fields: UpdateTeamFields,
): Promise<void> {
  await update(tx, teamId, fields);
}
