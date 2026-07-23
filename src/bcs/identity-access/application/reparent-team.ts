import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { CrossOrgReparentError, CycleError } from "../domain/team";
import { findById, updateParent } from "../infrastructure/teams-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

/**
 * Reparents a team, enforcing (FR-009, FR-010): the new parent must belong
 * to the same organization, and the move must not create a cycle. Both
 * checks run inside a per-organization Postgres advisory lock (research.md
 * §3) so two concurrent reparents that would jointly create a cycle
 * serialize instead of racing — unlike `005-org-tenant-model`'s single
 * global bootstrap lock, this is scoped to the organization, since the
 * invariant it protects is itself per-organization.
 */
export async function reparentTeam(
  tx: Tx,
  teamId: string,
  newParentId: string,
): Promise<void> {
  const team = await findById(tx, teamId);
  if (!team) {
    throw new Error(`No team found with id "${teamId}".`);
  }

  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('team-reparent'), hashtext(${team.organizationId}))`,
  );

  const newParent = await findById(tx, newParentId);
  if (!newParent) {
    throw new Error(`No team found with id "${newParentId}".`);
  }
  if (newParent.organizationId !== team.organizationId) {
    throw new CrossOrgReparentError();
  }

  if (newParentId === teamId) {
    throw new CycleError();
  }

  // Walk the prospective new parent's ancestor chain — if `teamId` appears
  // anywhere in it, `teamId` is already an ancestor of `newParentId`, and
  // making `newParentId` its parent would create a cycle (research.md §2).
  const seen = new Set<string>();
  let currentId: string | null = newParentId;
  while (currentId && !seen.has(currentId)) {
    if (currentId === teamId) {
      throw new CycleError();
    }
    seen.add(currentId);
    const current = await findById(tx, currentId);
    currentId = current?.parentTeamId ?? null;
  }

  await updateParent(tx, teamId, newParentId);
}
