# Research: API Keys

## 1. Scope shape validated structurally, not against a closed enum

**Decision**: A scope string must match `^[a-z][a-z0-9-]*:(read|write|run)$` — a lowercase resource identifier, a colon, and one of a small fixed action set (`read`/`write`/`run`, per `context/auth-conventions.md`'s examples). The resource half is not checked against any registry of real resource types.

**Rationale**: Directly implements this feature's `/speckit-clarify` answer. `identity-access` does not own or import other bounded contexts' resource definitions (constitution Principle II), and none of the resource-owning contexts this scope model anticipates (`prompt-registry`, `workflow-orchestration`, `governance`) have any code in the new TypeScript scaffold yet — a closed enum here would need editing every time an unrelated context adds a resource type, exactly the coupling Principle II exists to prevent.

**Alternatives considered**:
- A closed, hardcoded list of valid scope strings owned by this feature — rejected per the clarification answer (Option A).
- No format validation at all — rejected: contradicts the spec's own edge case ("a scope string that doesn't match the required shape is rejected"), and a completely unvalidated free-text field is a worse foundation for the permission-cap check in §2 below, which needs to reliably parse the action half.

## 2. Scope grants capped at the creator's own role, since no finer permission model exists yet

**Decision**: `isScopeAllowedForRole(scope, role)` — `"admin"` may request any well-formed scope; `"member"` may request only scopes ending in `:read`. `createApiKey` rejects any requested scope that fails this check (FR-003), for every scope in the request, before performing any write.

**Rationale**: This codebase currently has exactly one privilege axis: `users.role` (`"admin" | "member"`). No bounded context beyond `identity-access` exists yet in the new scaffold, so there is no real per-resource permission matrix to cap against. Mapping the creator-permission cap onto the only axis that exists mirrors every other admin-vs-member split already established in this bounded context (`updateUser`'s self-or-admin split, `assertCanManageInvitationsForTeam`'s admin-or-owner split) — non-admin members are, throughout this bounded context, restricted to read/self-scoped actions unless they specifically own the resource in question. Since a generic `<resource>:<action>` scope has no per-resource ownership concept to check, the safe default for a member is read-only; write/run scopes are elevated actions reserved for admins, consistent with how every existing mutation in this bounded context already gates non-admin callers.

**Alternatives considered**:
- No cap at creation time (defer entirely to consuming routes) — rejected per the clarification answer (Option B rejected in favor of Option A): would let a low-privileged member mint a broadly-scoped key regardless of their real access, an unintended privilege-escalation path.
- Build a full per-resource permission registry now, keyed by future resource types — rejected as premature: no consuming bounded context exists yet to validate against, and this codebase's own conventions (`CLAUDE.md`) explicitly favor deferring abstractions with no current caller.
- Re-check a key's scopes against its owner's *current* role on every authentication (not just at creation) — considered, but explicitly deferred (edge case documented in spec.md): this feature only enforces the cap at creation time; re-checking on every use is a broader policy question left to the routes/services that consume `authenticateApiKey`'s output, consistent with this feature building only the domain/application/infrastructure layer.

## 3. Key generation and hashing: `node:crypto`, no new dependency

**Decision**: Raw key = `"sk_" + randomBytes(32).toString("base64url")` (256 bits of CSPRNG entropy, matching the token-generation margin `009-invitations`' research.md §2 already established for this codebase). Stored hash = `createHash("sha256").update(rawKey).digest("hex")` (backlog item's explicit requirement: SHA-256). Display prefix = the first 12 characters of the raw key (`sk_` plus 9 characters of entropy) — enough to let a user recognize which key is which in a list without revealing anything reconstructible, matching the legacy Python service's exact prefix length.

**Rationale**: `node:crypto` is a Node built-in — no new dependency, same reasoning `009-invitations` already applied to its own token generation. SHA-256 (rather than a slow password-hashing function like bcrypt) is correct here because API keys are high-entropy random values, not low-entropy user-chosen passwords — a fast, deterministic hash is the correct primitive for looking up a high-entropy secret by exact value (this is also the backlog item's explicit, non-negotiable requirement, and matches the legacy `apikey_service.py`'s own approach).

**Alternatives considered**:
- bcrypt (matching password hashing) — rejected: bcrypt is designed to be slow specifically to resist brute-forcing *low*-entropy secrets; applied to a 256-bit random value it adds real latency to every authenticated request for zero security benefit, and it isn't a keyed/exact-match lookup, which `authenticateApiKey` needs (raw key → single row by hash) — bcrypt intentionally makes that lookup pattern (compare against many stored hashes) impractical at scale, whereas SHA-256 supports a direct indexed equality lookup.

## 4. Owning-user liveness is re-checked on every authentication

**Decision**: `authenticateApiKey` resolves the key's owning user via `users-repo.findById` and returns "not authenticated" (`null`) if that user no longer exists or `isActive` is `false`, in addition to the key's own active/expiry checks.

**Rationale**: Not spelled out as its own edge case in spec.md, but directly implied by basic security correctness: `deactivateUser` (`007-user-accounts-registration`) is this codebase's mechanism for cutting off a user's access. If a deactivated user's API keys kept authenticating, deactivation would be silently incomplete for any client authenticating via a key instead of a session — a significant, easy-to-miss gap between two supposedly-equivalent authentication paths. This is an implementation-level consequence of already-decided behavior (`deactivateUser`'s existing contract), not new user-facing scope requiring another `/speckit-clarify` round.

**Alternatives considered**:
- Trust the key's own `is_active` flag only, without re-checking the owning user — rejected: would leave a deactivated user's keys fully functional indefinitely, defeating the purpose of deactivation for any non-browser client.

## 5. No REST route or UI built by this feature

**Decision**: This feature stops at the application layer (`src/bcs/identity-access/{domain,application,infrastructure}`). No `src/app/` route handler or settings-UI page is added.

**Rationale**: Matches the identical, twice-established precedent already set by `007-user-accounts-registration`, `008-jwt-session-auth`, and `009-invitations` for this same epic — HTTP/UI wiring belongs to `backlog/007-distribution`, which depends on epic 002 finishing first. `bcs/identity-access/CONTRACT.md` already lists `authenticateApiKey`, `createApiKey`, `revokeApiKey` in its "Exposed APIs" table (pre-dating this feature's implementation), confirming Distribution is the intended caller.

**Alternatives considered**: Building a minimal key-management route/page now — rejected for the same reason the three prior features in this epic rejected it: duplicates work `007-distribution` already owns, ahead of that epic's conventions existing in any real route yet.
