import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UserSummary } from "../domain/user";
import { SESSION_COOKIE_NAME } from "../domain/session";
import { verifySessionJwt } from "../infrastructure/jwt";
import { getUser } from "./get-user";

type Db = PostgresJsDatabase<Record<string, never>>;

function extractSessionToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === SESSION_COOKIE_NAME) {
      return rest.join("=");
    }
  }
  return null;
}

/**
 * Resolves the calling user from a session cookie header (FR-005). Never
 * throws for a missing/invalid/expired session — resolves `null` — since
 * that's the routine "not signed in" outcome, not an infrastructure
 * failure. Re-reads the user's *current* org/team/role via `getUser`, never
 * trusting the JWT's own claims beyond `sub` (context/auth-conventions.md).
 */
export async function authenticateSession(
  db: Db,
  cookieHeader: string | null | undefined,
): Promise<UserSummary | null> {
  const token = extractSessionToken(cookieHeader);
  if (!token) {
    return null;
  }
  const claims = await verifySessionJwt(token);
  if (!claims) {
    return null;
  }
  try {
    return await getUser(db, claims.sub);
  } catch {
    return null;
  }
}
