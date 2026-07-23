import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { findByParent } from "../infrastructure/teams-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

export interface TeamSummary {
  id: string;
  name: string;
  slug: string;
  parentTeamId: string | null;
}

/**
 * Lists a team's immediate sub-teams (parentTeamId provided), or an
 * organization's root-level teams (parentTeamId: null) — FR-005.
 */
export async function listSubTeams(
  db: Tx,
  organizationId: string,
  parentTeamId: string | null,
): Promise<TeamSummary[]> {
  const rows = await findByParent(db, organizationId, parentTeamId);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentTeamId: row.parentTeamId,
  }));
}
