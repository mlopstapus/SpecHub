# Auth & Session Conventions

**Status:** Decided
**Decided:** 2026-07-21
**Backlog item:** `backlog/000-foundations/006-auth-and-session-conventions.md`

## JWT claims and expiry

Carries forward the current shape: `sub` (userId), `role`, `exp`, signed HS256, expiry configurable via `jwt_expiry_hours` (default unchanged from today).

**Claims stay minimal — no `organization_id`/`team_id` in the JWT.** Every request re-resolves the user's current org/team from `getUser(userId)` (Identity & Access's contract call). This costs one extra DB read per request versus embedding the claims, but avoids the stale-claim class of bug (a user's team changes mid-session; their still-valid JWT claims the old team) — the safer tradeoff at this scale, and consistent with Identity & Access being the single source of truth for those facts rather than letting them leak into a token that can outlive their accuracy.

## Refresh strategy

**No refresh token at launch — an expired JWT requires a full re-login.** The current system has no refresh flow, and adding one is additive later (doesn't require redesigning the cookie/claim shape now) — so it's explicitly deferred rather than designed in prematurely. `jwt_expiry_hours` should be set long enough (e.g. default 24h, configurable) that this isn't a disruptive UX in practice.

**Revisit trigger:** add a refresh/sliding-expiry mechanism if session length complaints come up in practice, or before any SaaS tier where "logged out mid-workday" would be a support burden.

## Cookie flags

| Flag | Value | Why |
|---|---|---|
| `httpOnly` | `true` | No JS access to the token, mitigates XSS token theft |
| `secure` | `true` outside local dev | Tenet C2 — no functional insecure default |
| `sameSite` | `lax` | Frontend and API are the same origin (unified Next.js app per `architecture.md`) — `lax` is sufficient CSRF mitigation for same-origin apps *as long as* no state-changing route accepts a plain `GET` (confirmed below) |
| `domain` | Unset (host-only) at launch | No `*.skillcanon.example` subdomain-per-tenant pattern exists yet; revisit if that URL structure is adopted for SaaS |

## CSRF approach

**`sameSite=lax` cookies, no separate CSRF token.** Contingent on every state-changing endpoint requiring `POST`/`PUT`/`PATCH`/`DELETE` — never a `GET` — which is already the REST convention and is enforced by route handler review (a state-changing `GET` route is itself a bug independent of CSRF). If a future requirement introduces cross-origin state changes (e.g. a public webhook-triggered mutation that isn't already signature-verified), that specific route gets its own explicit CSRF exemption review, not a blanket token scheme added everywhere.

## API key scoping model

Carries forward the current `scopes` JSON column on `ApiKey`, with scope granularity at the **resource-type + read/write** level (e.g. `prompts:read`, `prompts:write`, `workflows:run`) rather than per-individual-resource ACLs — matches MCP tool usage patterns (a key is typically "read-only for this integration" or "full access for this CI job"), and avoids building a full ACL system nothing currently requires. `authenticateApiKey` (Identity & Access's contract call) returns the resolved scope list for Distribution to check per-route.

## Startup secret validation

Carries forward: the app fails to start (not just logs a warning) if `jwt_secret` is unset or still at its placeholder/default value, checked once in the TS app's boot sequence before it starts accepting connections — the direct TS-port equivalent of tenet C2's existing requirement.

## Deliverable status

JWT claim shape/expiry, refresh posture, cookie flags, CSRF approach, API key scoping, and startup validation are settled. Must land before `002-identity-access`'s auth features start, which it now does.
