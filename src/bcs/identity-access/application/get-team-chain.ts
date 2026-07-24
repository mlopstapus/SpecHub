import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { TeamChainEntry } from "../domain/team";
import { findById, findByOrgAndId } from "../infrastructure/teams-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

/**
 * Returns the ordered chain from `teamId` up to its root: self-first,
 * root-last (FR-006/FR-007). Stability-guaranteed shape per
 * bcs/identity-access/CONTRACT.md — Governance's resolution correctness
 * depends on this exact ordering.
 *
 * Mirrors the current Python `get_team_chain`'s parent-pointer walk, with a
 * `seen` guard against a corrupted (cyclic) hierarchy — this feature's own
 * cycle prevention (FR-010) should make that unreachable in practice, but
 * the guard keeps this read path from ever infinite-looping regardless.
 *
 * Unlike the current Python implementation (which returns `[]` for an
 * unknown starting id), this throws — a deliberate, documented improvement
 * (spec.md Edge Cases), not part of the "match exactly" ordering contract.
 *
 * `organizationId` is mandatory (011-tenant-isolation-rls, M1): the starting
 * lookup is scoped via `findByOrgAndId`, so a `teamId` belonging to a
 * different organization throws the same as a nonexistent one. Subsequent
 * ancestor-walk steps stay unscoped — safe without re-checking, since
 * `createTeam`/`reparentTeam` already guarantee a team's parent always
 * shares its organization.
 */
export async function getTeamChain(
  db: Tx,
  organizationId: string,
  teamId: string,
): Promise<TeamChainEntry[]> {
  const chain: TeamChainEntry[] = [];
  const seen = new Set<string>();
  let currentId: string | null = teamId;
  let first = true;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const team: Awaited<ReturnType<typeof findById>> = first
      ? await findByOrgAndId(db, organizationId, currentId)
      : await findById(db, currentId);
    first = false;
    if (!team) {
      break;
    }
    chain.push({ id: team.id, name: team.name, parentTeamId: team.parentTeamId });
    currentId = team.parentTeamId;
  }

  if (chain.length === 0) {
    throw new Error(`No team found with id "${teamId}".`);
  }

  return chain;
}
