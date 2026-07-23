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
