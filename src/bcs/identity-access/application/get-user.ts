import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UserSummary } from "../domain/user";
import { findById } from "../infrastructure/users-repo";

/**
 * Reads one user by id, returning the `UserSummary` shape only (never
 * `username`, `display_name`, `is_active`, `password_hash`, or timestamps —
 * bcs/identity-access/CONTRACT.md). Completes an API `CONTRACT.md` already
 * promised before this feature existed to implement it.
 */
export async function getUser(
  db: PostgresJsDatabase<Record<string, never>>,
  userId: string,
): Promise<UserSummary> {
  const row = await findById(db, userId);
  if (!row) {
    throw new Error(`No user found with id "${userId}".`);
  }
  return {
    id: row.id,
    orgId: row.organizationId,
    teamId: row.teamId,
    role: row.role as "admin" | "member",
    email: row.email,
  };
}
