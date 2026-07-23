import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { ProvisionTeamAndAdmin } from "./bootstrap-organization";
import { createTeam } from "./create-team";
import { insertValidatedUser } from "./insert-validated-user";
import { update as updateTeam } from "../infrastructure/teams-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

export interface ProvisionTeamAndAdminParams {
  team: { name: string; slug: string };
  admin: {
    username: string;
    displayName?: string;
    email: string;
    password: string;
  };
}

/**
 * The real `provisionTeamAndAdmin` callback (FR-010), replacing
 * `bootstrapOrganization`'s test-only stub. Mirrors the legacy Python
 * `register_admin`'s create-team → create-user → set-owner sequence
 * (research.md §3): creates the root team, creates the admin user via the
 * shared `insertValidatedUser` core (no caller to authorize against — this
 * *is* the first user), then sets the new team's `owner_id`.
 */
export function makeProvisionTeamAndAdmin(
  params: ProvisionTeamAndAdminParams,
): ProvisionTeamAndAdmin {
  return async (tx: Tx, organizationId: string) => {
    const { id: teamId } = await createTeam(tx, {
      organizationId,
      name: params.team.name,
      slug: params.team.slug,
    });

    const { id: userId } = await insertValidatedUser(tx, {
      organizationId,
      teamId,
      username: params.admin.username,
      displayName: params.admin.displayName ?? params.admin.username,
      email: params.admin.email,
      password: params.admin.password,
      role: "admin",
    });

    await updateTeam(tx, teamId, { ownerId: userId });

    return { teamId, userId };
  };
}
