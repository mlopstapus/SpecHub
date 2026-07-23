# Feature Specification: JWT Session Auth

**Feature Branch**: `008-jwt-session-auth`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "/Users/ben/repos/SkillCanon/backlog/002-identity-access/004-jwt-session-auth.md"

## Clarifications

### Session 2026-07-23

- Q: Should this feature emit audit events for login (success/failure) and logout itself, or is that left for the audit-compliance epic to retrofit later, the way it's retrofitting other epic-002 mutations? → A: This feature calls the real audit write path itself, now — login success, login failure, and logout are all recorded as audit events by this feature, not deferred to a later retrofit.
- Q: Epic `003-audit-compliance`'s own `EPIC.md` states it depends on all of `002-identity-access` being done first, which conflicts with the answer above (this feature needs a real audit write path *before* that epic starts). How should that sequencing conflict resolve? → A: Reorder — this feature takes an explicit new dependency on `003-audit-compliance/001-audit-event-schema-and-write-path` specifically (not the whole epic), pulling that one item forward so the real `record()` write path exists when this feature needs it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log in with email and password (Priority: P1)

A registered user visits SkillCanon, enters their email and password, and is signed in so they can use the app.

**Why this priority**: Without this, no one can authenticate into the web UI at all — every other feature in the product sits behind this.

**Independent Test**: Submit a known-good email/password pair and confirm the response establishes an authenticated session; submit a wrong password or unknown email and confirm it is rejected.

**Acceptance Scenarios**:

1. **Given** a registered, active user with a known password, **When** they submit their correct email and password, **Then** they are signed in and their session is delivered as an httpOnly cookie the browser will send on subsequent requests.
2. **Given** a registered user, **When** they submit an incorrect password, **Then** they receive a generic "invalid credentials" error and no session cookie is set.
3. **Given** no account exists for a submitted email, **When** that email/password pair is submitted, **Then** the response is identical in form to a wrong-password attempt (no indication the email doesn't exist).
4. **Given** a user account that has been deactivated, **When** they submit otherwise-correct credentials, **Then** the login is rejected the same way as invalid credentials.
5. **Given** any login attempt, succeeding or failing, **When** it completes, **Then** an audit event recording the attempt is written, and the submitted password never appears in that record.

---

### User Story 2 - Stay signed in across requests (Priority: P2)

A signed-in user continues browsing SkillCanon, and every page/action they take recognizes them as the same authenticated user without asking them to log in again, until their session expires or they explicitly log out.

**Why this priority**: This is what makes "signing in" actually useful — every protected page and API route depends on being able to resolve "who is making this request" from the session.

**Independent Test**: With a valid session cookie from a prior login, make a subsequent request and confirm it resolves to the same user's identity; with an expired or tampered session cookie, confirm the request is treated as not signed in rather than erroring or granting access.

**Acceptance Scenarios**:

1. **Given** a valid, unexpired session cookie, **When** any part of the application asks "who is this request from," **Then** it receives that user's identity (id, organization, team, role, email).
2. **Given** a session cookie whose expiry has passed, **When** the same lookup is performed, **Then** it resolves to "no user," not the expired user's identity and not an error.
3. **Given** a session cookie that has been tampered with or does not match the signing key, **When** the same lookup is performed, **Then** it resolves to "no user," identically to a missing or expired session.
4. **Given** no session cookie is present at all, **When** the same lookup is performed, **Then** it resolves to "no user" without raising an error.

---

### User Story 3 - Log out (Priority: P3)

A signed-in user chooses to log out, ending their session on this device.

**Why this priority**: Necessary for shared/public-device safety and standard account-management expectations, but lower stakes than being able to log in or stay logged in at all.

**Independent Test**: While signed in, trigger logout and confirm a subsequent request no longer resolves to that user; trigger logout with no active session and confirm it does not error.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they log out, **Then** their session cookie is cleared and subsequent requests no longer resolve to their identity.
2. **Given** no active session, **When** logout is triggered anyway, **Then** it completes without error (idempotent).
3. **Given** a signed-in user logs out, **When** the logout completes, **Then** an audit event recording the logout is written for that user.

---

### User Story 4 - Operator is protected from an insecure default signing secret (Priority: P2)

An operator deploying SkillCanon (self-hosted or otherwise) cannot end up running a live instance whose sessions are signed with a known/default secret, which would let anyone forge a valid session.

**Why this priority**: A silent insecure default is a standing security hole for every deployment that misses it — this is a launch-blocking safety net, not a nice-to-have, and is called out explicitly by the project's compliance principles.

**Independent Test**: Start the application with the signing secret unset or left at its placeholder value and confirm it does not reach a running state; start it with a real secret configured and confirm it starts normally.

**Acceptance Scenarios**:

1. **Given** the session-signing secret is unset, **When** the application starts, **Then** it refuses to start rather than accepting traffic.
2. **Given** the session-signing secret is still at its known placeholder/default value, **When** the application starts, **Then** it refuses to start.
3. **Given** the session-signing secret is set to a real, non-placeholder value, **When** the application starts, **Then** it starts normally and accepts traffic.

---

### Edge Cases

- What happens when a user logs in, their session is issued, and then their role or team changes mid-session? The session's own claims stay unchanged (minimal claims by design); any lookup that needs current role/team re-resolves it from the user's live record rather than trusting the session's snapshot.
- How does the system handle a session cookie sent over a non-secure (plain HTTP) connection outside local development? The cookie is marked secure outside local dev, so a compliant browser will not transmit it over plain HTTP in the first place.
- How does logout behave if the session cookie was already expired at the time of the logout request? Still succeeds (clearing an already-invalid cookie is a no-op in effect, but the endpoint doesn't error).
- What happens if two devices are signed in as the same user and one of them logs out? Only that device's session cookie is cleared; this feature does not implement cross-device/session-list revocation.
- What happens if the audit event for a login or logout cannot be written (e.g. the audit store is unavailable)? The login/logout does not silently succeed while its audit record is lost — the action fails closed, consistent with the project's audit-write guarantee that a mutation and its audit record never diverge.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to authenticate by submitting an email and password.
- **FR-002**: System MUST verify the submitted password against the user's stored credential and reject non-matching or unknown-email attempts with a single, generic invalid-credentials response that does not reveal whether the email is registered.
- **FR-003**: On successful authentication, system MUST establish a session for the user and deliver it to the browser as an httpOnly cookie that page scripts cannot read.
- **FR-004**: The session cookie MUST be marked secure in every environment except local development, and MUST use a same-site policy sufficient to mitigate cross-site request forgery for a same-origin application.
- **FR-005**: System MUST provide a single way for any part of the application to resolve the current request's session to the authenticated user's identity (id, organization, team, role, email), returning "no user" — never an error — for a missing, expired, or invalid session.
- **FR-006**: A session MUST stop being honored once its configured expiry elapses; the system MUST NOT silently renew or extend a session's lifetime.
- **FR-007**: System MUST provide a logout action that ends the current session by clearing the session cookie, and MUST succeed without error whether or not a session was actually active.
- **FR-008**: Only active (non-deactivated) user accounts MAY authenticate; a deactivated account's credentials MUST be rejected the same way as invalid credentials.
- **FR-009**: System MUST refuse to start if the secret used to sign sessions is unset or left at a known placeholder/default value.
- **FR-010**: Session resolution MUST reject a session whose signature does not verify (tampered or forged), treating it identically to an expired or missing session.
- **FR-011**: Every login attempt MUST be recorded as an audit event — on success, identifying the authenticated user; on failure, identifying the attempted email (and the matching user, if the email resolves to a real account) — and MUST NOT record the submitted password in any form.
- **FR-012**: Every logout MUST be recorded as an audit event identifying the user who logged out.
- **FR-013**: If a login or logout's audit event cannot be written, the login/logout itself MUST NOT be reported as successful — the two never diverge.

### Key Entities

- **Session**: Represents a signed-in user's authenticated state for the browser. Carries the user's identity, role, and an expiry; issued at login, delivered and read via a cookie, and invalidated by expiry or logout. Does not carry organization/team, which are always re-resolved live from the user's current record.
- **User Credential**: The email + hashed password pair a user authenticates with. Owned by account registration (a prior, dependency feature); this feature only reads and verifies it, never creates or edits it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with valid credentials reaches an authenticated state in a single submit, with no additional confirmation step.
- **SC-002**: 100% of requests presenting an expired, tampered, or missing session are treated as not-signed-in — none are granted access as if authenticated.
- **SC-003**: Invalid login attempts return an identical response regardless of whether the submitted email belongs to an existing account.
- **SC-004**: An operator cannot bring the application into a running, traffic-accepting state while the session-signing secret is missing or at its placeholder value — verified by an automated boot-time check.
- **SC-005**: A signed-in user remains recognized as authenticated across subsequent requests, with no re-entry of credentials, until their session's expiry passes or they log out.

## Assumptions

- Builds directly on the prior user-accounts feature for underlying user records and password-hash storage; this feature covers session issuance, validation, and teardown only — not account creation.
- No refresh-token or sliding-expiry mechanism ships with this feature (resolves this feature's carried-forward open question): an expired session requires a full re-login. This is a deliberate, documented deferral (`context/auth-conventions.md`), not an oversight — revisit if session-length complaints arise or before any tier where being signed out mid-workday is a support burden.
- Default session lifetime is 24 hours and is configurable per deployment, matching the current system's behavior.
- No login rate-limiting or account lockout is introduced by this feature — matches current system behavior; brute-force protection would be a separate, explicitly scoped feature if it becomes a requirement.
- Startup secret validation fails closed (refuses to start) rather than starting with a loud warning — this is the decided severity, not the softer alternative the originating backlog item left open.
- The session cookie has no explicit domain attribute (host-only) at launch — no subdomain-per-tenant pattern exists yet for this to accommodate.
- Programmatic/MCP access continues to use the separate scoped API-key mechanism; this feature governs only the browser/web-UI session and does not change or overlap with API-key authentication.
- This feature takes a new, explicit dependency on `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md` (the `audit.audit_events` table and `record()` function), pulled forward ahead of that item's originally-planned epic-level sequencing so login/logout audit events (FR-011–FR-013) have a real write path to call. The originating backlog item (`backlog/002-identity-access/004-jwt-session-auth.md`) predates this decision and does not yet list that dependency — its dependency list should be updated to match.
