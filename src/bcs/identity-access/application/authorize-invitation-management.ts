import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { InvalidTeamAssignmentError, NotAuthorizedError, type UserSummary } from "../domain/user";
import { findById as findTeamById } from "../infrastructure/teams-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

/**
 * Shared admin-or-team-owner authorization for `inviteUser`/`revokeInvitation`
 * (research.md §3, per this feature's `/speckit-clarify` answer). Loads and
 * returns the team so callers don't have to fetch it twice.
 */
export async function assertCanManageInvitationsForTeam(
  tx: Tx,
  actingUser: UserSummary,
  teamId: string,
) {
  const team = await findTeamById(tx, teamId);
  if (!team || team.organizationId !== actingUser.orgId) {
    throw new InvalidTeamAssignmentError();
  }
  if (actingUser.role !== "admin" && team.ownerId !== actingUser.id) {
    throw new NotAuthorizedError();
  }
  return team;
}
