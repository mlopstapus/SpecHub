import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createTeam } from "./create-team";
import { reparentTeam } from "./reparent-team";
import { findById } from "../infrastructure/teams-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

export interface InsertTeamBetweenParams {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  ownerId?: string;
}

/**
 * Creates a new team taking `childTeamId`'s current parent position, then
 * reparents `childTeamId` under the new team (FR-011) — composes
 * `createTeam` + `reparentTeam` rather than duplicating their invariant
 * checks.
 */
export async function insertTeamBetween(
  tx: Tx,
  params: InsertTeamBetweenParams,
  childTeamId: string,
): Promise<{ id: string }> {
  const child = await findById(tx, childTeamId);
  if (!child) {
    throw new Error(`No team found with id "${childTeamId}".`);
  }

  const inserted = await createTeam(tx, {
    ...params,
    parentTeamId: child.parentTeamId ?? undefined,
  });

  await reparentTeam(tx, childTeamId, inserted.id);

  return inserted;
}
