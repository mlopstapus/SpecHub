# Feature Specification: User Accounts & Registration

**Feature Branch**: `007-user-accounts-registration`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "backlog/002-identity-access/003-user-accounts-and-registration.md — Port `User` from the current Python `models.py`/`user_service.py`, correcting the uniqueness constraints from global to org-scoped — the specific multi-tenancy bug PDR-003 exists to prevent (two different orgs both wanting a user named "admin")."

## Clarifications

### Session 2026-07-23

- Q: Should the system block deactivating an organization's last remaining active admin? → A: Block it — deactivation is rejected if the target is the organization's last remaining active admin.
- Q: Can a non-admin user update their own profile fields (e.g. `display_name`), or is all user management admin-only? → A: Self-or-admin — a user may update their own non-privileged fields; `role`, `is_active`, and `team_id` remain admin-only to change. (`organization_id` is immutable for anyone — refined during planning, see FR-004.)
- Q: What minimum password requirement should account creation enforce? → A: 8-character minimum, with no additional complexity rules enforced by this feature.
- Q: Should email/username uniqueness comparisons be case-sensitive or case-insensitive within an organization? → A: Case-insensitive — values are normalized before comparison and storage, so "Admin" and "admin" are treated as the same email/username.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Org-scoped user identity, not global (Priority: P1)

An admin in Organization A creates a user with email `admin@example.com`. Separately, an admin in Organization B creates their own user, also with email `admin@example.com`. Both succeed — organizations never collide over usernames or emails that are common across installs (e.g. "admin"), which is the exact bug the current globally-unique schema has today.

**Why this priority**: This is the foundational correctness fix the whole feature exists for (PDR-003). Every other requirement in this feature builds on the `users` table being organization-scoped from the start; getting this wrong reintroduces the bug this feature was created to close.

**Independent Test**: Create two organizations, create a user with the same email and username in each, and verify both persist with no conflict. Then attempt a second user with the same email inside a single organization and verify it is rejected.

**Acceptance Scenarios**:

1. **Given** two distinct organizations, **When** each creates a user with email `admin@example.com`, **Then** both users are created successfully with no uniqueness conflict.
2. **Given** an organization that already has a user with email `owner@example.com`, **When** an admin attempts to create a second user in that same organization with the same email, **Then** the request is rejected with a clear "already exists" error.
3. **Given** an organization that already has a user with username `jsmith`, **When** an admin attempts to create a second user in that same organization with the same username, **Then** the request is rejected.
4. **Given** an organization that already has a user with email `Owner@example.com`, **When** an admin attempts to create a second user in that same organization with email `owner@example.com`, **Then** the request is rejected as a duplicate — comparison is case-insensitive.

---

### User Story 2 - Admin manages the user roster (Priority: P2)

An admin within an organization creates new user accounts for teammates, updates an existing user's details, deactivates a departing teammate's account, and lists users scoped to a team or to the whole organization — all without ever seeing a password hash in any response.

**Why this priority**: Once org-scoped identity exists (Story 1), this is the day-to-day administrative surface every organization needs to onboard and manage its people. It depends on Story 1's schema but delivers the actual usable CRUD value.

**Independent Test**: As an admin, create a user, update a non-privileged field on that user, deactivate a different user, and list users filtered by team and by organization — verify each response shape and confirm `password_hash` never appears in any of them.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they create a new user with a valid team assignment within their own organization, **Then** the user is created with a bcrypt password hash stored and never returned in the response.
2. **Given** an existing active user who is not the organization's last remaining active admin, **When** an admin deactivates that user, **Then** the user's `is_active` flag becomes false and the row is retained (not deleted).
3. **Given** users spread across multiple teams in an organization, **When** an admin lists users filtered by a specific team, **Then** only users belonging to that team are returned.
4. **Given** an authenticated admin, **When** they list users without a team filter, **Then** all users in their own organization are returned, and no user from any other organization appears.
5. **Given** any response shape that includes user data (e.g. a list of users, or a single user read), **When** the response body is inspected, **Then** it never contains a `password_hash` field. (Create/update/deactivate return no user data at all — an id, or nothing — so this guarantee is structural for those three, and behaviorally tested for list/read.)
6. **Given** an organization with exactly one active admin, **When** an admin attempts to deactivate that last remaining active admin, **Then** the request is rejected and the user remains active.
7. **Given** an admin creating a new user, **When** the supplied password is fewer than 8 characters, **Then** the request is rejected before any row is written.

---

### User Story 3 - First-run registration provisions a real admin, not a stub (Priority: P3)

An operator standing up a brand-new self-hosted SpecHub instance completes the first-run registration form. This single action creates a real Organization, a real root Team, and a real admin User together — replacing the test-only stub that `bootstrapOrganization` (built in the Organization & Tenant Model feature) currently calls in place of real team/user provisioning.

**Why this priority**: This closes out the bootstrap chain started by the Organization & Tenant Model feature and depended on by Team Hierarchy, but it is only reachable once org-scoped `User` (Story 1) and admin-only creation (Story 2) already exist — it's the capstone, not the entry point.

**Independent Test**: Start from an empty database, submit the first-run registration form, and verify exactly one real Organization, one real root Team, and one real admin User now exist and are correctly linked — with no stub data involved.

**Acceptance Scenarios**:

1. **Given** a fresh install with zero organizations, **When** first-run registration completes, **Then** a real root `Team` and a real admin `User` are created in the same atomic transaction as the `Organization`, replacing the prior test-only stub.
2. **Given** the entitlement check gating the registration route, **When** the route is invoked, **Then** `resolveEntitlements()` is called and evaluated before any Organization/Team/User rows are written.
3. **Given** the registration transaction fails partway (e.g. user creation errors after the team is written), **When** the transaction rolls back, **Then** no Organization, Team, or User row persists.

---

### Edge Cases

- What happens when an admin tries to create a user whose `team_id` belongs to a different organization than the one the admin is scoped to? Rejected — a user's `team_id` must belong to the same `organization_id` as the user itself.
- What happens when a non-admin user attempts to create, update, or deactivate another user? Rejected with an authorization error — these operations are admin-only (or self-or-admin for a user's own non-privileged fields; see FR-004).
- What happens when someone attempts to create a user without a `team_id`? Rejected — every user must belong to a team (per dependency on Team Hierarchy).
- What happens when the registration route's entitlement check fails to resolve (e.g. the entitlement key is missing or `resolveEntitlements()` errors)? The route fails closed — registration does not proceed — consistent with the constitution's "fails closed" governance posture.
- What happens when an admin deactivates the last remaining active admin in an organization? Rejected — deactivation is blocked when the target is the organization's last remaining active admin, so no organization can be left with zero admins.
- What happens when a create/update request supplies a `password_hash` value directly instead of a plaintext password? Rejected — the API only ever accepts a plaintext password field and computes the hash server-side; there is no endpoint or field that accepts a pre-computed hash.
- What happens when two emails or usernames within the same organization differ only by case (e.g. `Admin` vs `admin`)? Treated as a duplicate and rejected — uniqueness comparison is case-insensitive.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist users in an `identity_access.users` table with `id`, `organization_id`, `team_id`, `username`, `display_name`, `email`, `password_hash` (nullable), `role`, `is_active`, and creation/update timestamps.
- **FR-002**: System MUST enforce uniqueness of `(organization_id, email)` and `(organization_id, username)` — never a bare global uniqueness on `email` or `username` alone. Comparison MUST be case-insensitive (values normalized before comparison and storage), so that values differing only by case within the same organization are treated as duplicates.
- **FR-003**: System MUST restrict user creation to admin callers, and MUST create the user within the caller's own organization only.
- **FR-004**: System MUST support updating an existing user's fields, scoped to the same organization as the caller; privileged fields (`role`, `is_active`, `team_id`) are admin-only to change, while an authenticated user MAY update their own non-privileged fields (e.g. `display_name`). `organization_id` is immutable post-creation — no update path changes it, admin or otherwise (no legitimate cross-tenant reassignment flow exists; see Assumptions). Changing a password is not part of this update operation (see Assumptions).
- **FR-005**: System MUST support deactivating a user (admin-only), which sets `is_active` to false without deleting the row.
- **FR-006**: System MUST support listing users scoped to the caller's own organization, optionally filtered to a specific team, and MUST NOT return users belonging to any other organization.
- **FR-007**: System MUST hash passwords via bcrypt before persisting them, and MUST NOT persist or accept a plaintext password in any stored field.
- **FR-008**: System MUST NOT include `password_hash` in any API response shape, for any of the create, update, list, or deactivate operations.
- **FR-009**: System MUST enforce that a user's `team_id` refers to a team within the same `organization_id` as the user.
- **FR-010**: System MUST replace `bootstrapOrganization`'s test-only stub with a real `provisionTeamAndAdmin` callback that creates actual `teams` and `users` rows, in the same atomic transaction as Organization creation.
- **FR-011**: The first-run registration route MUST call `resolveEntitlements()` and confirm the relevant entitlement is enabled before performing any Organization/Team/User provisioning; the gated entitlement key MUST default to enabled for both Free and Paid tiers, since Billing & Entitlements does not yet exist to configure it otherwise.
- **FR-012**: `role` MUST be constrained to the values `"admin"` and `"member"`, matching the `UserSummary` contract already exposed to other bounded contexts.
- **FR-013**: System MUST reject a deactivation request that would leave an organization with zero active admins (i.e. deactivating the organization's last remaining active admin is blocked).
- **FR-014**: System MUST require passwords to be at least 8 characters at creation time, and MUST reject shorter passwords before any row is written; no additional complexity rules (character-class mixing, etc.) are enforced by this feature.

### Key Entities

- **User**: An account belonging to exactly one Organization and exactly one Team within it. Carries login identity (`username`, `email`, bcrypt `password_hash`), display identity (`display_name`), authorization (`role`), and lifecycle state (`is_active`). Uniqueness for `email` and `username` is scoped to the owning Organization, not global.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two different organizations can each register a user with email `admin@example.com` with zero conflict, verified by an automated test.
- **SC-002**: 100% of attempts to create a second user with a duplicate email or username inside the same organization are rejected, verified by an automated test.
- **SC-003**: `password_hash` never appears in any shape capable of carrying it: verified structurally for create (returns only an id), update, and deactivate (return no user payload at all) by their minimal return types, and verified behaviorally by a response-shape test for list and single-user reads, which do return user data.
- **SC-004**: A fresh self-hosted install completes first-run registration end-to-end — a real Organization, root Team, and admin User all present and linked — with zero manual database setup steps and zero remaining test-only stub code in the bootstrap path.
- **SC-005**: An admin can provision a new teammate's account in a single request/action, without needing direct database access.
- **SC-006**: 100% of attempts to deactivate an organization's last remaining active admin are rejected, verified by an automated test — no organization can be left with zero admins through this feature's operations.
- **SC-007**: 100% of account-creation attempts with a password shorter than 8 characters are rejected before any row is persisted, verified by an automated test.

## Assumptions

- Deactivation is a soft-delete (`is_active = false`); this feature does not add a hard-delete/purge path for user rows.
- Self-service member registration/invitations (a user other than the first-run admin joining an organization) is explicitly out of scope for this feature — it is owned by the separate `005-invitations.md` backlog item (epic 002-identity-access).
- Session/JWT-based authentication for these routes is out of scope here — covered separately by `004-jwt-session-auth.md`; this feature assumes an existing "authenticated admin caller" concept is available to gate against.
- The entitlement key gating first-run registration (FR-011) is a placeholder, always-enabled key (e.g. `core.registration`) until Billing & Entitlements (epic 008) exists to make it configurable — mirroring the tracked-exception pattern used in `specs/005-org-tenant-model/plan.md`'s Complexity Tracking.
- `password_hash` is nullable at the schema level to accommodate a future invitation flow where a user row may exist before a password is set; this feature does not itself create any user with a null `password_hash` (both create-user and first-run registration always set a password immediately).
- Changing an existing user's password (a "reset"/"change password" operation) is out of scope for this feature's update operation — the source backlog item doesn't request one, and a real password-reset flow likely needs session/JWT concepts (`004-jwt-session-auth.md`, not yet built) to identify who's allowed to change whose password. A password is only ever set once, at account-creation time (by `createUser` or first-run registration).
