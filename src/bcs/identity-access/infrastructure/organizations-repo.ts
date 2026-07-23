import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { organizations } from "./schema";

type Tx = PostgresJsDatabase<Record<string, never>>;

export interface InsertOrganizationParams {
  name: string;
  slug: string;
}

export async function count(tx: Tx): Promise<number> {
  const rows = await tx.select({ id: organizations.id }).from(organizations);
  return rows.length;
}

export async function insert(
  tx: Tx,
  params: InsertOrganizationParams,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(organizations)
    .values({ name: params.name, slug: params.slug })
    .returning({ id: organizations.id });
  if (!row) {
    throw new Error("Organization insert returned no row.");
  }
  return row;
}

export async function findById(tx: Tx, id: string) {
  const [row] = await tx
    .select()
    .from(organizations)
    .where(eq(organizations.id, id));
  return row;
}
