import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { TeamChainEntry } from "../domain/team";
import { findById } from "../infrastructure/teams-repo";

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
 */
export async function getTeamChain(
  db: Tx,
  teamId: string,
): Promise<TeamChainEntry[]> {
  const chain: TeamChainEntry[] = [];
  const seen = new Set<string>();
  let currentId: string | null = teamId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const team = await findById(db, currentId);
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
