# Contract: Identity & Access — Auth surface

This feature adds the following to `src/bcs/identity-access/index.ts`. `bcs/identity-access/CONTRACT.md` is updated in the same change (the `authenticateSession` row already exists there — this feature is what implements it — and `login`/`logout` are newly listed).

## `login(db, email: string, password: string): Promise<{ user: UserSummary; cookie: SessionCookieDescriptor } | null>`

Looks up the active user by email (case-insensitive, matching `007-user-accounts-registration`'s normalize-on-write convention — comparison lowercases the input, no new index needed since `users.email` is already stored lowercased). Verifies the password via `bcryptjs.compare` against `password_hash`. Returns `null` (never throws) if the email doesn't resolve to an active user, or the password doesn't match — identical shape for both, per FR-002's non-enumeration requirement. On success, signs a JWT (`sub`, `role`, `exp` — `context/auth-conventions.md`), builds the session cookie descriptor, writes a `user.login` audit event (or `user.login_failed` on the rejected path — see below), and returns the `UserSummary` + cookie.

Writes an audit event on **every** call, success or failure (FR-011): `action: "user.login"` with `actorUserId`/`organizationId` set to the authenticated user on success; `action: "user.login_failed"` with `actorUserId`/`organizationId` set to the matching user's if the email resolved to a real (if wrong-password or deactivated) account, or both `null` if the email matched no account at all. The submitted password is never included in the event.

If the audit write itself fails, `login()` throws (does not return `null` or a success value) — FR-013.

**Consumers**: Not currently called by any route — `backlog/007-distribution/001-rest-api-core-routes.md`'s login route calls it once that epic exists (research.md §5).

## `authenticateSession(db, cookieHeader: string | null | undefined): Promise<UserSummary | null>`

Parses the raw `Cookie` request-header value for this feature's session-cookie name, verifies the JWT (signature + `exp`) via `getJwtSecret()`, and resolves to a `UserSummary` by re-reading the user's *current* org/team/role from `getUser(db, claims.sub)` — never trusting the JWT's own claims for anything beyond `sub` (the token intentionally carries no `orgId`/`teamId`, per `context/auth-conventions.md`). Takes `db` explicitly, matching every other contract function's convention (`getUser(db, userId)`, etc.) — `bcs/identity-access/CONTRACT.md`'s existing `authenticateSession(request)` row is updated in this change to reflect the concrete `(db, cookieHeader)` signature, since "request" was a placeholder from before this feature decided route handlers aren't built here (research.md §5) — a future Distribution route handler passes `request.headers.get("cookie")` as `cookieHeader`. Returns `null` — never throws — for a missing cookie, a missing/wrong-name cookie, an expired token, or a signature that fails to verify (FR-005/FR-010, spec.md's tampered/expired/missing edge cases are all indistinguishable to the caller).

**Consumers**: `backlog/007-distribution/001-rest-api-core-routes.md` (every ported route's own auth check), Distribution generally per `bcs/identity-access/CONTRACT.md`.

## `logout(db, userId: string): Promise<{ cookie: SessionCookieDescriptor }>`

Writes a `user.logout` audit event for `userId`, then returns a session cookie descriptor with an empty value and `maxAge: 0` for the caller (a future route handler) to set, clearing the cookie client-side. Idempotent by construction — `logout` doesn't check whether a session was actually active (there's nothing server-side to check; a stateless JWT's "activeness" is only ever evaluated by `authenticateSession`), so calling it with any valid `userId` always succeeds (FR-007). If the audit write fails, `logout()` throws rather than returning the clearing cookie (FR-013).

**Consumers**: Not currently called by any route — `backlog/007-distribution/001-rest-api-core-routes.md`'s logout route calls it once that epic exists.

## Not exposed

`signSessionJwt`/`verifySessionJwt` (`infrastructure/jwt.ts`) stay internal to `identity-access` — no other BC signs or verifies a session JWT directly; they only ever call `authenticateSession`.
