import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { isSelfHosted } from "../domain/deployment-mode";
import { SecondOrganizationNotAllowedError } from "../domain/organization";
import {
  count,
  insert,
  type InsertOrganizationParams,
} from "../infrastructure/organizations-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

/**
 * Arbitrary, application-specific advisory-lock key — serializes concurrent
 * organization-bootstrap attempts against the same Postgres instance
 * (research.md §3). Not tied to any row or entity; just a constant every
 * caller of createOrganization agrees on.
 */
const ORGANIZATION_BOOTSTRAP_LOCK_KEY = 892_737_465;

const UNIQUE_VIOLATION = "23505";

/**
 * Guarded organization insert (FR-002, FR-006): in self-hosted mode, rejects
 * a second organization before writing anything; the `slug` uniqueness
 * constraint (enforced at the DB level regardless of mode) surfaces as a
 * clean thrown error rather than a raw driver error.
 *
 * The advisory lock is only acquired in self-hosted mode — it exists solely
 * to close the count-then-insert TOCTOU race on the single-org guard
 * (research.md §3). SaaS mode has no such guard to protect and legitimately
 * creates many organizations concurrently, so it skips the lock entirely
 * rather than serializing every organization creation platform-wide behind
 * one global key; slug-uniqueness concurrency there is already handled
 * correctly by the DB-level unique constraint alone.
 *
 * Must be called from within an existing transaction (`tx`) — the advisory
 * lock, when taken, is transaction-scoped (`pg_advisory_xact_lock`) and
 * auto-releases on commit/rollback.
 */
export async function createOrganization(
  tx: Tx,
  params: InsertOrganizationParams,
): Promise<{ id: string }> {
  const selfHosted = isSelfHosted();

  if (selfHosted) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${ORGANIZATION_BOOTSTRAP_LOCK_KEY})`,
    );
    if ((await count(tx)) > 0) {
      throw new SecondOrganizationNotAllowedError();
    }
  }

  try {
    return await insert(tx, params);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error(
        `An organization with slug "${params.slug}" already exists.`,
      );
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }
  if ("code" in err && (err as { code?: unknown }).code === UNIQUE_VIOLATION) {
    return true;
  }
  // drizzle-orm's postgres-js driver wraps the real Postgres error (which
  // carries the SQLSTATE `.code`) as `.cause` on a DrizzleQueryError.
  const cause = (err as { cause?: unknown }).cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
