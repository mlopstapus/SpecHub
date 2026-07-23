import { jwtVerify, SignJWT } from "jose";
import { getJwtExpiryHours, getJwtSecret } from "@/shared/config";
import type { SessionClaims } from "../domain/session";

const ALGORITHM = "HS256";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

/** Signs a minimal-claim (sub/role/exp) JWT (context/auth-conventions.md). */
export async function signSessionJwt(claims: SessionClaims): Promise<string> {
  const expiryHours = getJwtExpiryHours();
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.sub)
    .setExpirationTime(`${expiryHours}h`)
    .setIssuedAt()
    .sign(secretKey());
}

/**
 * Verifies a session JWT's signature and expiry. Resolves `null` — never
 * throws — for an expired, tampered, or otherwise invalid token (FR-010);
 * still throws if `JWT_SECRET` itself is missing/placeholder, since that's
 * an infrastructure failure, not a routine invalid-session outcome.
 */
export async function verifySessionJwt(
  token: string,
): Promise<SessionClaims | null> {
  const key = secretKey(); // throws uncaught if JWT_SECRET is missing/placeholder — an infra failure, not a routine invalid-session outcome
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] });
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return { sub: payload.sub, role: payload.role as SessionClaims["role"] };
  } catch {
    return null;
  }
}
