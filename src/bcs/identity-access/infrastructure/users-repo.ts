import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { users } from "./schema";

type Tx = PostgresJsDatabase<Record<string, never>>;

export interface InsertUserParams {
  organizationId: string;
  teamId: string;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  role: "admin" | "member";
}

export interface UpdateUserFields {
  displayName?: string;
  email?: string;
  username?: string;
  role?: "admin" | "member";
  isActive?: boolean;
  teamId?: string;
}

export async function insert(
  tx: Tx,
  params: InsertUserParams,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(users)
    .values({
      organizationId: params.organizationId,
      teamId: params.teamId,
      username: params.username,
      displayName: params.displayName,
      email: params.email,
      passwordHash: params.passwordHash,
      role: params.role,
    })
    .returning({ id: users.id });
  if (!row) {
    throw new Error("User insert returned no row.");
  }
  return row;
}

export async function findById(tx: Tx, id: string) {
  const [row] = await tx.select().from(users).where(eq(users.id, id));
  return row;
}

/**
 * Returns every user matching `email` (already-lowercased), across *all*
 * organizations, active or not. Login has no organization context yet to
 * scope by — email is only unique per-organization (PDR-003), not globally
 * — so more than one row can come back if two different organizations each
 * have an account with this email (research.md §8). Includes deactivated
 * users deliberately: FR-008 requires `login()` to still *reject* them, but
 * FR-011's audit trail is meant to identify "the matching user, if the
 * email resolves to a real account" even when that account is deactivated
 * — that's a real login-attempt-against-a-real-account, not the same as an
 * unknown email, even though both produce the same public "invalid
 * credentials" response.
 */
export async function findByEmail(tx: Tx, email: string) {
  return tx.select().from(users).where(eq(users.email, email));
}

/** Returns `undefined` if the id exists but belongs to a different organization — used for cross-org checks (M3). */
export async function findByOrgAndId(
  tx: Tx,
  organizationId: string,
  id: string,
) {
  const [row] = await tx
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.organizationId, organizationId)));
  return row;
}

export async function update(
  tx: Tx,
  id: string,
  fields: UpdateUserFields,
): Promise<void> {
  await tx.update(users).set(fields).where(eq(users.id, id));
}

export async function countActiveAdmins(
  tx: Tx,
  organizationId: string,
): Promise<number> {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.organizationId, organizationId),
        eq(users.role, "admin"),
        eq(users.isActive, true),
      ),
    );
  return rows.length;
}

export async function listByOrgAndTeam(
  tx: Tx,
  organizationId: string,
  teamId?: string,
) {
  return tx
    .select()
    .from(users)
    .where(
      teamId === undefined
        ? eq(users.organizationId, organizationId)
        : and(eq(users.organizationId, organizationId), eq(users.teamId, teamId)),
    );
}
