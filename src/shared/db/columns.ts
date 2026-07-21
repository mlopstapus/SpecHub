import { timestamp, uuid } from "drizzle-orm/pg-core";

/** Primary key, never reused (matches Identity & Access's stability guarantee). */
export function id() {
  return uuid("id").primaryKey().defaultRandom();
}

/**
 * Required tenant scope. Omit entirely on a genuinely global table (e.g.
 * `billing.plans`) — there is no nullable/opt-out variant, since a table
 * either has a tenant or it doesn't.
 */
export function organizationId() {
  return uuid("organization_id").notNull();
}

/**
 * `updated_at` is informational only (last-write-wins on concurrent
 * updates) — the kernel does not provide optimistic-concurrency conflict
 * detection (see spec.md Clarifications).
 */
export function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  };
}
