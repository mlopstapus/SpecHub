# Feature Specification: Invitations

**Feature Branch**: `009-invitations`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "/Users/ben/repos/SpecHub/backlog/002-identity-access/005-invitations.md"

## Clarifications

### Session 2026-07-23

- Q: Who should be authorized to create and revoke invitations for a team? → A: Org admins or the target team's owner — an organization admin may act on any team, and a team's designated owner (`teams.owner_id`) may also create/revoke invitations for their own team even if their account role is "member."
- Q: What state should a revoked invitation show as when an admin views the invitation list (User Story 4)? → A: A distinct "revoked" state, alongside pending/accepted/expired — not folded into "expired" and not removed from the list.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invite a teammate by email (Priority: P1)

An organization admin — or the target team's designated owner — invites someone to join their organization, on a specific team and with a specific role, by entering that person's email address.

**Why this priority**: Without a way to invite people in, an organization can never grow past whoever registered it directly — this is the entry point for every subsequent member of a tenant.

**Independent Test**: As an admin, submit an email/team/role for someone not yet in the organization and confirm an invitation is created with a unique, unguessable token and an expiry; confirm delivery is attempted through the configured email provider, or logged for retrieval if no provider is configured.

**Acceptance Scenarios**:

1. **Given** an org admin, or the owner of the target team, and an email not associated with any account in this organization, **When** they create an invitation for that email to a specific team and role, **Then** an invitation record is created with a unique token, an expiry, and delivery of the invite is attempted (via the configured email provider, or logged for local/self-hosted retrieval if none is configured).
2. **Given** a user who is neither an organization admin nor the target team's owner, **When** they attempt to create an invitation, **Then** it is rejected as unauthorized.
3. **Given** a pending, unexpired invitation already exists for an email in this organization, **When** another invitation is created for that same email in this organization, **Then** it is rejected with a clear error rather than creating a duplicate.
4. **Given** an email already belongs to an active account in this same organization, **When** an invitation is created for that email, **Then** it is rejected with a clear error.
5. **Given** an email belongs to an active account in a *different* organization, **When** an invitation is created for that email in this organization, **Then** it succeeds normally — organization membership is scoped per organization, not global.
6. **Given** a prior invitation for an email expired or was revoked, **When** a new invitation is created for that same email, **Then** it succeeds (the stale invitation does not block a fresh one).

---

### User Story 2 - Accept an invitation and join the organization (Priority: P1)

Someone who received an invitation opens it, sets up their account (username and password), and becomes an active member of the exact organization, team, and role they were invited to.

**Why this priority**: Accepting is the half of the flow that actually delivers the value of an invitation — creating an invite that no one can redeem accomplishes nothing.

**Independent Test**: With a valid, unexpired, not-yet-accepted invitation token, submit a username and password and confirm a new active user is created scoped to the invitation's organization, team, and role, and that the same token cannot be used again afterward.

**Acceptance Scenarios**:

1. **Given** a valid, unexpired, unaccepted invitation token, **When** the invitee submits it along with a username and password, **Then** a new active user account is created scoped to exactly the invitation's organization, team, and role, and the invitation is marked accepted.
2. **Given** an invitation token that has already been accepted, **When** it is submitted again, **Then** it is rejected with a clear error and no second account is created.
3. **Given** an invitation token whose expiry has passed, **When** it is submitted to accept, **Then** it is rejected with a clear error.
4. **Given** an invitation created for organization A, **When** it is accepted, **Then** the resulting account can only ever be scoped to organization A — there is no input to the acceptance flow that can redirect the new account into a different organization.
5. **Given** a chosen username that is already taken within the invitation's organization, **When** the invitee attempts to accept with that username, **Then** it is rejected with a clear error and the token remains valid for a retry with a different username.

---

### User Story 3 - Revoke a pending invitation (Priority: P3)

An org admin, or the target team's owner, cancels an invitation that hasn't been accepted yet — for example, it was sent to the wrong email, or the role changed before the person joined.

**Why this priority**: Useful cleanup and correction capability, but the organization functions correctly without it; a mis-sent invitation simply expires on its own if never revoked.

**Independent Test**: As an admin, revoke a pending invitation and confirm its token no longer works for acceptance and its state is now "revoked"; attempt to revoke an already-accepted invitation and confirm it has no effect on the now-existing account.

**Acceptance Scenarios**:

1. **Given** a pending, unaccepted invitation, **When** an admin or the team's owner revokes it, **Then** its token is permanently rejected if later submitted for acceptance, and its state changes to a distinct "revoked" state (not "expired").
2. **Given** an invitation that has already been accepted, **When** an admin attempts to revoke it, **Then** the action has no effect on the account that was already created (there is nothing left to revoke).
3. **Given** a user who is neither an organization admin nor the target team's owner, **When** they attempt to revoke an invitation, **Then** it is rejected as unauthorized.

---

### User Story 4 - View outstanding invitations (Priority: P3)

An org admin looks at the list of invitations sent for their organization to see who has been invited but hasn't joined yet.

**Why this priority**: Supporting/visibility capability for admins managing membership; not required for the core invite-and-accept flow to deliver value.

**Independent Test**: As an admin, create, accept, expire, and revoke one invitation each, and confirm all four appear in the organization's invitation list with the correct, distinct state (pending, accepted, expired, revoked).

**Acceptance Scenarios**:

1. **Given** an organization with invitations in each of the four states, **When** an admin views the invitation list, **Then** each invitation shows its email, team, role, and current state — pending, accepted, expired, or revoked as a distinct value, not folded into another state — scoped only to this organization's invitations.

---

### Edge Cases

- What happens when no email provider is configured (self-hosted install without SMTP set up)? The invitation is still created and usable; delivery is skipped with a clear log line (including the invite link) instead of failing the whole operation.
- What happens if the email provider is configured but the send itself fails (transient outage, bad address, etc.)? The invitation record is still created and remains valid — email delivery is best-effort and is never a precondition for the invitation to exist or be shared with the invitee some other way.
- What happens if someone registers directly with the same email in the same organization through a separate path before an outstanding invitation for that email is accepted? Accepting the now-stale invitation afterward fails with a clear error rather than silently creating a duplicate/conflicting account.
- What happens if the team an invitation targets is deleted before the invitation is accepted? This cannot happen — the underlying data model prevents a team from being deleted at all while any invitation (in any state) still references it, so acceptance never encounters a dangling team reference for this reason.
- What happens when an invitation is revoked, then someone attempts to accept it? Same rejection path as an expired token — a clear error, no account created.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow an organization admin, or the target team's designated owner, to create an invitation specifying an email address, a target team within their organization, and a role.
- **FR-002**: System MUST generate a unique, unguessable token for each invitation and an expiry timestamp beyond which the invitation can no longer be accepted.
- **FR-003**: System MUST reject creation of a new invitation when a pending, unexpired invitation already exists for the same email within the same organization.
- **FR-004**: System MUST reject creation of a new invitation when the email already belongs to an active user account within the same organization; an email already registered in a *different* organization MUST NOT block invitation creation.
- **FR-005**: System MUST attempt to deliver the invitation by email through the configured provider; if no provider is configured, delivery MUST be skipped with a clear log line (including the invitation link) rather than failing the operation.
- **FR-006**: System MUST allow accepting a pending, unexpired invitation by submitting its token together with a chosen username and password, creating a new active user scoped to exactly that invitation's organization, team, and role.
- **FR-007**: The organization a new account is scoped to on acceptance MUST be derived solely from the invitation's own token/record — no other input to the acceptance flow may determine or override it, making a cross-organization redemption structurally impossible rather than merely checked.
- **FR-008**: System MUST reject acceptance of an invitation whose expiry has passed, that has already been accepted, or that has been revoked, with a clear, non-generic-crash error, and MUST NOT create an account in any of those cases.
- **FR-009**: System MUST reject acceptance when the submitted username is already taken within the invitation's organization, without invalidating the token — the same token MUST remain usable for a retry.
- **FR-010**: System MUST allow an organization admin, or the target team's designated owner, to revoke a pending (not yet accepted) invitation, after which its token is permanently rejected for acceptance and its state changes to a distinct "revoked" value; revoking an already-accepted invitation MUST have no effect on the resulting account.
- **FR-011**: System MUST allow an organization admin to list invitations for their own organization only, showing each invitation's email, team, role, and current state as one of four distinct values: pending, accepted, expired, or revoked.
- **FR-012**: Invitation creation, acceptance, and revocation MUST each be recorded as an audit event identifying who performed the action and on which invitation/organization.
- **FR-013**: An invitation-creation or invitation-revocation request from a user who is neither an organization admin nor the target team's owner MUST be rejected as unauthorized.

### Key Entities

- **Invitation**: Represents an open offer for a specific email to join one organization on one team with one role. Carries a unique redemption token, an expiry, who issued it, and its current lifecycle state (pending, accepted, expired, or revoked — each a distinct, mutually exclusive value). Belongs to exactly one organization and one team; never transferable to another organization.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An invited person can go from receiving an invitation to being an active, correctly-scoped member of the organization in a single acceptance step, with no manual account provisioning by an admin.
- **SC-002**: 100% of expired, revoked, or already-accepted invitation tokens are rejected on attempted use — none result in a new or duplicate account.
- **SC-003**: An invitation created for one organization never results in a new member landing in a different organization — zero cross-tenant membership leakage.
- **SC-004**: A self-hosted install with no email provider configured can still complete the full invite-and-accept flow using the logged invitation link, with no required third-party account.
- **SC-005**: Duplicate pending invitations for the same email within an organization are prevented automatically, with no manual admin cross-checking required.

## Assumptions

- Organization admins may create, revoke, or list invitations for any team in their organization; a team's designated owner (`teams.owner_id`) may also create or revoke invitations for their own team specifically, even without the admin role. Listing (User Story 4) remains an organization-admin-only capability in this feature — a team owner viewing only their own team's outstanding invitations is not built here and can be added later without a data-model change, since the state/entity model already supports it.
- Duplicate-pending-invitation and already-registered checks are scoped per organization, not per team within an organization — consistent with users and teams already being organization-scoped (not team-scoped) elsewhere in this bounded context.
- Invitation expiry defaults to 7 days from creation and is expected to be operator/deployment configurable, matching the prior system's configurable-expiry behavior.
- Email delivery is best-effort: neither an unconfigured provider nor a failed send blocks invitation creation. This directly applies the decision already recorded in `context/third-party-services.md` (SES for the managed SaaS, generic SMTP for self-host, skipped with a log line if unset) — this feature does not need to re-decide that question.
- Revoking an invitation is a state change to a distinct "revoked" value (its token becomes permanently unusable), not a hard delete and not folded into "expired" — preserves an audit trail of invitations that existed and were canceled, and lets the listing view (FR-011) distinguish "ran out the clock" from "an admin/owner intentionally canceled it," consistent with this project's general audit-retention posture.
- This feature builds on `003-user-accounts-and-registration` (account creation on acceptance) and `004-jwt-session-auth` (resolving "who is the admin creating/revoking/listing invitations" via session); it does not itself change either.
- Consistent with this epic's established pattern (`007-user-accounts-registration`, `008-jwt-session-auth`), this feature builds the domain/application/infrastructure layer only — no REST route or UI page ships as part of this feature; HTTP and UI wiring belong to the distribution epic, which depends on this epic completing first.
