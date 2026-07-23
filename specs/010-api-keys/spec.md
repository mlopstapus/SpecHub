# Feature Specification: API Keys

**Feature Branch**: `010-api-keys`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "/Users/ben/repos/SpecHub/backlog/002-identity-access/006-api-keys.md"

## Clarifications

### Session 2026-07-23

- Q: Should scope creation validate against a closed, hardcoded list of known scopes, or only a structural pattern? → A: Structural pattern only — validates `<resource>:<action>` shape without checking the resource name against a real registry; identity-access doesn't own other bounded contexts' resource definitions.
- Q: Can a user mint an API key with a scope they don't personally have access to, or must a key's granted scopes be capped at the creator's own current permissions? → A: Capped at the creator's own permissions — a key can never grant more access than its owner already has via their role; otherwise a key becomes a privilege-escalation path.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate an API key for programmatic access (Priority: P1)

A developer connecting an IDE, MCP client, or automation job to their SkillCanon instance generates a scoped API key — giving it a name and selecting the specific access it needs — and is shown the raw key value once, to store and use outside the browser session.

**Why this priority**: This is the entry point for every non-browser integration (IDEs, MCP clients, CI jobs); nothing else in this feature has value without a way to first mint a key.

**Independent Test**: As an authenticated user, create a key with a name and at least one scope; confirm the raw key value is returned exactly once in the creation response, and that no subsequent read of that key (individually or in a list) ever exposes the raw value again.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they create an API key with a name and one or more scopes, **Then** a key record is created and the raw key value is returned in the creation response.
2. **Given** a newly created key, **When** the same key is retrieved afterward by any means (detail view, list view, database inspection), **Then** the raw value is not present in any form — only a display prefix and derived metadata are visible.
3. **Given** an authenticated user creating a key, **When** they submit the request with no scopes selected, **Then** creation is rejected — a key is never created with silent full or default access.
4. **Given** an authenticated user, **When** they request a scope for a key that they do not themselves currently have access to via their own role, **Then** creation is rejected — a key can never grant more access than its creator already has.

---

### User Story 2 - Authenticate a request using an API key (Priority: P1)

An external client (IDE, MCP tool, CI job) presents a previously issued API key on a request; the system resolves it back to the owning user, their organization, and the scopes the key grants, without any browser session involved.

**Why this priority**: This is the actual purpose the keys exist for — authenticating traffic outside the session-cookie flow. A key that can be created but never authenticate anything delivers no value.

**Independent Test**: Using the raw key from a freshly created key, call the authentication resolution with that raw value and confirm it returns the correct owning user, organization, and scopes; call it with a garbage or unrecognized string and confirm it returns "not authenticated" rather than an error or crash.

**Acceptance Scenarios**:

1. **Given** a valid, active, unexpired key's raw value, **When** it is presented for authentication, **Then** the system resolves the exact user and organization that own the key, along with its granted scopes.
2. **Given** an unrecognized or malformed key value, **When** it is presented for authentication, **Then** authentication fails cleanly (no match, no exception).
3. **Given** a valid key's raw value, **When** it is used to authenticate successfully, **Then** the key's last-used timestamp is updated to reflect that use.

---

### User Story 3 - Revoke a key (Priority: P2)

A key's owner — or an organization admin acting on behalf of a user in their organization — revokes a key that's no longer needed or may have leaked, immediately cutting off any future use of it.

**Why this priority**: Essential security hygiene once keys exist in the wild, but the system already delivers its core value (stories 1 and 2) before this capability is needed for the first time.

**Independent Test**: Revoke an active key and confirm every subsequent authentication attempt with its raw value fails, even though the key record itself still exists (for history/audit purposes).

**Acceptance Scenarios**:

1. **Given** an active key, **When** its owner revokes it, **Then** the key is marked inactive and immediately fails authentication on any later attempt.
2. **Given** an active key belonging to another user in the same organization, **When** an organization admin revokes it, **Then** the same immediate deactivation occurs.
3. **Given** a user who is neither the key's owner nor an admin of the key owner's organization, **When** they attempt to revoke the key, **Then** the action is rejected as unauthorized.

---

### User Story 4 - Review issued keys (Priority: P3)

A user reviews the API keys they've created — or, as an org admin, the keys belonging to users in their organization — to see what's active, what scopes each grants, and when each was last used, without ever seeing the raw value again.

**Why this priority**: A visibility/audit convenience once several keys exist; the system functions correctly without it, since creation and revocation don't depend on a listing view.

**Independent Test**: Create two keys with different scopes, then list them and confirm each shows its name, prefix, scopes, expiry, active state, creation time, and last-used time — with no raw key or hash anywhere in the response.

**Acceptance Scenarios**:

1. **Given** a user with multiple keys, **When** they list their own keys, **Then** each entry shows name, prefix, scopes, expiry (if any), active/revoked state, creation time, and last-used time, and never the raw value or its hash.
2. **Given** an organization admin, **When** they list keys for a user in their organization, **Then** they see that user's keys with the same fields; keys belonging to users in other organizations are never included.

---

### Edge Cases

- What happens when a key's expiry has passed but it was never explicitly revoked? Authentication fails exactly as if it had been revoked — an expired key is never usable regardless of its active/inactive flag.
- What happens when an already-revoked key is presented for authentication again? It continues to fail every time; revocation is not a one-time effect that can be bypassed by retrying.
- What happens if two requests authenticate with the same key at nearly the same moment? Both succeed independently (a key isn't single-use); the last-used timestamp reflects whichever update lands last.
- What happens if a key is revoked while requests using it are already resolving? Authentication attempts that read the record after the revocation is committed fail; this feature does not need to interrupt already-in-flight requests that resolved a moment earlier.
- What happens if someone tries to create a key with a scope string that doesn't match the required `<resource>:<action>` shape? Creation is rejected with a clear error rather than silently storing a malformed scope; the resource name itself is not checked against a registry of real resource types.
- What happens if a user's role is downgraded after they already created a key with a now-out-of-reach scope? The existing key keeps working with the scope it was granted at creation time — this feature only enforces the creator's permissions at the moment of creation, not on every later authentication. Re-checking a key's scopes against its owner's current role on every use is a broader policy question left to the routes/services that consume `authenticateApiKey`'s output.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow any authenticated user to create an API key for themselves, specifying a name and one or more scopes matching the `<resource>:<action>` shape decided in `context/auth-conventions.md`, and optionally an expiry.
- **FR-002**: System MUST reject creation of a key with zero scopes selected — a key is never created with an implicit default or full-access grant. System MUST reject any scope string that does not match the required `<resource>:<action>` shape (action drawn from a small fixed set, e.g. `read`/`write`/`run`); it MUST NOT validate the resource name against a registry of real resource types, since identity-access does not own other bounded contexts' resource definitions.
- **FR-003**: System MUST reject creation of a key requesting any scope the creating user does not themselves currently have access to via their own role — a key's granted scopes are always capped at its creator's own current permissions, never broader.
- **FR-004**: System MUST return the raw key value to its creator exactly once, in the creation response, and MUST NOT make it retrievable, displayable, or reconstructible through any interface, log, or stored value afterward.
- **FR-005**: System MUST persist only a one-way hash of the raw key value plus a short, non-secret display prefix — never the raw value itself, in any column or record.
- **FR-006**: System MUST provide an authentication resolution function that takes a raw presented key and, if it matches an active, unexpired key, returns the owning user's identity, resolved organization, and granted scopes; for any unrecognized, malformed, expired, or revoked key it MUST return "not authenticated" rather than raising an error.
- **FR-007**: System MUST reject authentication for a key that has been revoked or whose expiry has passed, even though the underlying record still exists.
- **FR-008**: System MUST update a key's last-used timestamp whenever it is successfully used to authenticate; a failed authentication attempt MUST NOT update it.
- **FR-009**: System MUST allow a key's owner to revoke their own key, and allow an organization admin to revoke any key belonging to a user in their organization; revocation MUST take effect immediately for all subsequent authentication attempts. A user who is neither the owner nor an admin of the owner's organization MUST be rejected as unauthorized.
- **FR-010**: System MUST allow a user to list their own keys, and an organization admin to list keys belonging to users in their organization, showing name, prefix, scopes, expiry, active/revoked state, creation time, and last-used time — never the raw value or its hash. Keys belonging to users outside the requester's own organization MUST NOT appear.
- **FR-011**: No log statement produced anywhere by key creation, authentication, revocation, or listing — or by any caller of the authentication resolution function — may include any portion of the raw key value, in whole or in part.
- **FR-012**: Creation and revocation of an API key MUST each be recorded as an audit event identifying who performed the action, which key/owner it affects, and the organization — consistent with this codebase's audit-logging pattern for security-sensitive identity-access mutations.

### Key Entities

- **API Key**: Represents a long-lived, scoped credential belonging to exactly one user (and, through that user, one organization) that authenticates non-browser clients. Carries a display name, an irreversible hash of its secret value, a short display prefix, a set of granted scopes, an optional expiry, an active/revoked state, and creation and last-used timestamps. The raw secret value exists only at the moment of creation and is never stored or re-derivable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can generate a working API key and successfully authenticate an external client with it without any admin involvement or manual provisioning step.
- **SC-002**: 100% of authentication attempts using an expired or revoked key are rejected — zero successful authentications occur past expiry or after revocation.
- **SC-003**: The raw key value is retrievable in exactly one place — the single creation response — and appears in 0% of subsequent API responses, database columns, or log lines in reversible form.
- **SC-004**: 100% of successful authentication attempts resolve to the correct owning user and organization, with zero cross-tenant or cross-user resolution errors.
- **SC-005**: Revoking a key stops it from authenticating on the very next attempt, with no delay or caching window during which a revoked key still succeeds.

## Assumptions

- Scope granularity follows the already-decided model in `context/auth-conventions.md`: resource-type plus read/write (e.g. `prompts:read`, `prompts:write`, `workflows:run`), not per-individual-resource ACLs. Validation at creation time checks only the `<resource>:<action>` shape, not that the resource name refers to a real, currently-existing resource type — identity-access doesn't own other bounded contexts' resource definitions.
- Ownership follows this codebase's established self-or-admin pattern for user-scoped resources: any user manages their own keys, and an organization admin additionally has visibility and revocation power over keys belonging to users within their own organization only.
- Determining whether a creating user "currently has access to" a requested scope (FR-003) relies on that user's existing role-based permission resolution, wherever that already lives in this codebase (e.g. their role on `identity_access.users`) — this feature does not introduce a new permission model, only checks against the existing one at key-creation time.
- Keys have no default expiry — an expiry is set only if the creator explicitly chooses one, matching the nullable `expires_at` column called for in the originating backlog item.
- Following this epic's established pattern (`007-user-accounts-registration`, `008-jwt-session-auth`, `009-invitations`), this feature builds only the domain/application/infrastructure layer — no REST route or UI page ships as part of this feature; HTTP and UI wiring belong to the distribution epic, which depends on this epic completing first.
- Rate limits on the number of keys a user may hold, and any UI affordance for copying/downloading the raw key at creation time, are out of scope — not called for in the originating backlog item.
- This feature builds on `003-user-accounts-and-registration` (the user identity a key belongs to) and the auth conventions decided in `backlog/000-foundations/006-auth-and-session-conventions.md`; it does not itself revisit either.
