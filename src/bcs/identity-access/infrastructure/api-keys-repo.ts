import { and, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { apiKeys } from "./schema";

type Tx = PostgresJsDatabase<Record<string, never>>;

export interface InsertApiKeyParams {
  /** Optional client-generated id — lets a caller (e.g. `createApiKey`) know the row's id before the insert commits, for use in the same transaction's audit event. Omit to let the column default apply. */
  id?: string;
  organizationId: string;
  userId: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: string[];
  expiresAt?: Date | null;
}

export async function insert(
  tx: Tx,
  params: InsertApiKeyParams,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(apiKeys)
    .values({
      ...(params.id ? { id: params.id } : {}),
      organizationId: params.organizationId,
      userId: params.userId,
      name: params.name,
      keyHash: params.keyHash,
      prefix: params.prefix,
      scopes: params.scopes,
      expiresAt: params.expiresAt ?? null,
    })
    .returning({ id: apiKeys.id });
  if (!row) {
    throw new Error("API key insert returned no row.");
  }
  return row;
}

export async function findByHash(tx: Tx, keyHash: string) {
  const [row] = await tx.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
  return row;
}

/** `undefined` if the id exists but belongs to a different organization — used for cross-org checks (M3). */
export async function findByOrgAndId(tx: Tx, organizationId: string, id: string) {
  const [row] = await tx
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId)));
  return row;
}

export async function listByOrgAndUser(tx: Tx, organizationId: string, userId: string) {
  return tx
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.organizationId, organizationId), eq(apiKeys.userId, userId)))
    .orderBy(desc(apiKeys.createdAt));
}

export async function updateLastUsedAt(tx: Tx, id: string): Promise<void> {
  await tx.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
}

export async function markRevoked(tx: Tx, id: string): Promise<void> {
  await tx.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
}
