import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { CrossOrgReparentError } from "../domain/team";
import { findById, insert, type InsertTeamParams } from "../infrastructure/teams-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

/**
 * Creates a team, optionally nested under a parent team. If a parent is
 * given, it must belong to the same organization as the new team (FR-009
 * applies at creation time, not just later reparenting).
 */
export async function createTeam(
  tx: Tx,
  params: InsertTeamParams,
): Promise<{ id: string }> {
  if (params.parentTeamId) {
    const parent = await findById(tx, params.parentTeamId);
    if (!parent || parent.organizationId !== params.organizationId) {
      throw new CrossOrgReparentError();
    }
  }
  return insert(tx, params);
}
