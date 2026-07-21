import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type TransactionOf<TSchema extends Record<string, unknown>> = Parameters<
  Parameters<PostgresJsDatabase<TSchema>["transaction"]>[0]
>[0];

/**
 * Establishes the current organization for one unit of work (a transaction),
 * so every tenant-scoped query and write within `fn` is subject to Postgres
 * row-level security for that organization (FR-004).
 *
 * Takes the Drizzle instance as an explicit parameter — rather than closing
 * over the shared kernel's singleton `db` — so the same helper is usable
 * identically from REST route handlers, MCP tool handlers, and integration
 * tests running against an ephemeral Testcontainers instance.
 *
 * Uses `set_config(..., true)` — the parameterizable equivalent of
 * `SET LOCAL` — rather than a literal `SET LOCAL` statement, since Postgres's
 * `SET` command does not accept bind parameters. `is_local = true` gives the
 * same transaction-scoped, auto-reset-on-commit/rollback behavior `SET LOCAL`
 * would, which is what keeps this correct under a transaction-mode PgBouncer
 * pool (FR-011) — the setting can never leak onto whatever the pooler hands
 * the underlying connection to next.
 */
export async function withTenantContext<
  T,
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema>,
  organizationId: string,
  fn: (tx: TransactionOf<TSchema>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_org_id', ${organizationId}, true)`,
    );
    return fn(tx);
  });
}
