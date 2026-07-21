---
epic: 002-identity-access
feature: 004-jwt-session-auth
status: open
dependencies: ["003-user-accounts-and-registration.md", "backlog/000-foundations/006-auth-and-session-conventions.md"]
---

# JWT Session Auth

Port login/JWT issuance from the current Python `auth_service.py`, delivered via an httpOnly cookie per the architecture session's decision, following the concrete claims/expiry/CSRF conventions from the auth foundations item.

## Requirements

- [ ] Login endpoint: verifies email + password (bcrypt), issues a JWT per `context/auth-conventions.md`'s claim shape, sets it as an httpOnly cookie
- [ ] `authenticateSession(request)` contract function: validates the cookie's JWT, returns the `UserSummary` or null
- [ ] Logout: clears the cookie
- [ ] Startup check: app refuses to start (or loudly warns, per the decided severity) if `JWT_SECRET` is unset or at a known placeholder value — carrying forward tenet C2's requirement
- [ ] Cookie flags (`httpOnly`, `secure` outside local dev, `sameSite`) match `context/auth-conventions.md` exactly

## Acceptance Criteria

- [ ] Successful login sets a cookie that `authenticateSession` correctly resolves back to the same user
- [ ] Invalid credentials return an auth error, no cookie set
- [ ] An expired JWT is rejected by `authenticateSession`, not silently accepted
- [ ] App fails to start (or logs a loud warning, per the foundations decision) when `JWT_SECRET` is missing/placeholder — verified by a boot-time test

## Open Questions

- Carried from `context/auth-conventions.md`: whether a refresh flow is added now or deferred — resolve before marking this feature done.

## Dependencies

- `003-user-accounts-and-registration.md`
- `backlog/000-foundations/006-auth-and-session-conventions.md`

## Technical Notes

Directly implements tenet C2's "no functional insecure default" bar — the current `config.py` ships a working dev JWT secret with no check it was changed; this feature is where that gets fixed, not carried forward. Distinct and separate from `006-api-keys.md`'s bearer-key auth, which remains the mechanism for MCP/API access per `bcs/identity-access/CONTRACT.md`.
