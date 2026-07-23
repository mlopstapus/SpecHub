import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  CrossOrgUserAccessError,
  LastActiveAdminError,
  NotAuthorizedError,
  type UserSummary,
} from "../domain/user";
import {
  countActiveAdmins,
  findByOrgAndId,
  update,
} from "../infrastructure/users-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

/**
 * Deactivates a user (admin-only, FR-005), refusing to leave an
 * organization with zero active admins (FR-013).
 */
export async function deactivateUser(
  tx: Tx,
  actingUser: UserSummary,
  targetUserId: string,
): Promise<void> {
  if (actingUser.role !== "admin") {
    throw new NotAuthorizedError();
  }

  const target = await findByOrgAndId(tx, actingUser.orgId, targetUserId);
  if (!target) {
    throw new CrossOrgUserAccessError();
  }

  if (target.role === "admin" && target.isActive) {
    const activeAdmins = await countActiveAdmins(tx, actingUser.orgId);
    if (activeAdmins <= 1) {
      throw new LastActiveAdminError();
    }
  }

  await update(tx, targetUserId, { isActive: false });
}
