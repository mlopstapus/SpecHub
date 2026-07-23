const UNIQUE_VIOLATION = "23505";

/**
 * Detects a Postgres unique-constraint violation (SQLSTATE 23505) thrown
 * through drizzle-orm's postgres-js driver, which wraps the real Postgres
 * error (carrying `.code`) as `.cause` on a `DrizzleQueryError` — per
 * `CLAUDE.md`'s documented gotcha, callers must check `err.cause?.code`,
 * not just `err.code`.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }
  if ("code" in err && (err as { code?: unknown }).code === UNIQUE_VIOLATION) {
    return true;
  }
  const cause = (err as { cause?: unknown }).cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
