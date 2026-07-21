import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type TransactionOf<TSchema extends Record<string, unknown>> = Parameters<
  Parameters<PostgresJsDatabase<TSchema>["transaction"]>[0]
>[0];

/**
 * Runs a mutation and its corresponding audit-event write in one
 * transaction, so either both commit or neither does (FR-006, PDR-005).
 *
 * `auditWriteFn` is a required parameter, not optional — there is no call
 * shape that performs the mutation without also attempting the audit write,
 * making the omission a compile error rather than an easy-to-miss step (per
 * PDR-005's stated design). It takes the same `tx` as `mutationFn` (rather
 * than a pre-built audit-event value this module would have to insert
 * itself) because the real `audit.audit_events` table's shape is owned by
 * Audit & Compliance's own future epic, not by this shared kernel — this
 * feature only guarantees the atomicity, not the audit table's structure.
 *
 * No delete path exists anywhere in this module, and none should be added
 * outside a future retention job (FR-009) — `audit.audit_events` rows are
 * never removed by application code.
 */
export async function withAudit<
  T,
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema>,
  mutationFn: (tx: TransactionOf<TSchema>) => Promise<T>,
  auditWriteFn: (tx: TransactionOf<TSchema>) => Promise<unknown>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await mutationFn(tx);
    await auditWriteFn(tx);
    return result;
  });
}
