import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { OrgSummary } from "../domain/organization";
import { findById } from "../infrastructure/organizations-repo";

/**
 * Reads one organization by id, returning the `OrgSummary` shape only
 * (FR-007) — never the raw row, so `stripe_customer_id` and timestamps
 * never leak to other bounded contexts.
 */
export async function getOrganization(
  db: PostgresJsDatabase<Record<string, never>>,
  organizationId: string,
): Promise<OrgSummary> {
  const row = await findById(db, organizationId);
  if (!row) {
    throw new Error(`No organization found with id "${organizationId}".`);
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    planId: row.planId,
  };
}
