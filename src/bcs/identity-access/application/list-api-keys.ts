import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { ApiKeySummary } from "../domain/api-key";
import { CrossOrgUserAccessError, NotAuthorizedError, type UserSummary } from "../domain/user";
import { listByOrgAndUser } from "../infrastructure/api-keys-repo";
import { findByOrgAndId as findUserByOrgAndId } from "../infrastructure/users-repo";

type Db = PostgresJsDatabase<Record<string, never>>;

/**
 * Lists keys for `targetUserId` (default: `actingUser`'s own keys), never
 * including `keyHash` or the raw value (FR-010). Listing someone else's
 * keys requires `actingUser.role === "admin"` and that the target exists in
 * `actingUser.orgId`.
 */
export async function listApiKeys(
  db: Db,
  actingUser: UserSummary,
  targetUserId?: string,
): Promise<ApiKeySummary[]> {
  const target = targetUserId ?? actingUser.id;

  if (target !== actingUser.id) {
    if (actingUser.role !== "admin") {
      throw new NotAuthorizedError();
    }
    const targetUser = await findUserByOrgAndId(db, actingUser.orgId, target);
    if (!targetUser) {
      throw new CrossOrgUserAccessError();
    }
  }

  const rows = await listByOrgAndUser(db, actingUser.orgId, target);
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  }));
}
