import type { UserRole } from "./user";

/** Session-cookie name, used by both `login`/`logout` (writers) and `authenticateSession` (reader). */
export const SESSION_COOKIE_NAME = "sh_session";

/** JWT claims (context/auth-conventions.md) — deliberately minimal, no orgId/teamId. */
export interface SessionClaims {
  sub: string;
  role: UserRole;
}

export interface SessionCookieDescriptor {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge?: number;
}
