# Feature Specification: Tenant Isolation Tests & RLS

**Feature Branch**: `011-tenant-isolation-rls`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md — Enable Postgres RLS on every identity_access.* table and build the reusable cross-tenant-denial test helper that every subsequent bounded-context epic's own tenant-isolation-tests feature will import, per tenets M1/M2/M3."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - RLS backstop proves cross-tenant leakage is structurally impossible (Priority: P1)

As an engineer responsible for the Identity & Access bounded context, I need Postgres itself — not just application code — to refuse to return or modify another organization's rows, so that a bug in an application-layer filter cannot leak or corrupt another tenant's data.

**Why this priority**: This is the core deliverable named in the backlog item and the concrete implementation of tenet M2 ("RLS is a backstop, not the primary control"). Without it, tenant isolation rests entirely on every present and future query getting its `organization_id` filter right, with no independent safety net.

**Independent Test**: Can be fully tested by writing a query directly against the database as a session scoped to organization A and attempting to read or write a row that belongs to organization B — the query returns zero rows / is rejected, even before any application code runs.

**Acceptance Scenarios**:

1. **Given** a database session scoped to organization A's `organization_id`, **When** that session queries a `teams`, `users`, `invitations`, or `api_keys` row belonging to organization B by its exact ID, **Then** the query returns no rows.
2. **Given** a database session scoped to organization A's `organization_id`, **When** that session attempts to update or delete a row belonging to organization B, **Then** the write affects zero rows.
3. **Given** the application-layer `organization_id` filter for a query is deliberately removed or broken (simulated in a test), **When** the same cross-organization read or write is attempted, **Then** the row-level security policy alone still denies it.

---

### User Story 2 - Reusable cross-tenant-denial test helper (Priority: P1)

As an engineer implementing a tenant-scoped resource — in this bounded context or a later one — I need a shared, documented test helper that proves cross-organization access-by-ID is denied, so that I don't have to re-derive the pattern from scratch for every resource type in every epic.

**Why this priority**: The backlog item is explicit that this helper is meant to be imported by every subsequent bounded-context epic's own tenant-isolation-tests feature. Without a documented, reusable shape, each future epic re-invents (and likely inconsistently implements) the same M3 negative test.

**Independent Test**: Can be fully tested by using the helper against one resource type end-to-end (create a resource in organization B, attempt to fetch/mutate it as organization A, assert denial) and by having another engineer follow only its documentation to apply it to a new resource type without help.

**Acceptance Scenarios**:

1. **Given** a resource creation function and a fetch-by-ID function for a given resource type, **When** the shared test helper is invoked with an org-A acting context and an org-B-owned resource, **Then** it asserts denial and fails the test if access unexpectedly succeeds.
2. **Given** an engineer who has not worked on this feature, **When** they read the helper's documentation, **Then** they can apply it to a new resource type without consulting this feature's implementation or another engineer.

---

### User Story 3 - Audited proof that every existing query is org-scoped (Priority: P2)

As an engineer maintaining this bounded context, I need every service-layer query already written in this epic's earlier features to be reviewed and confirmed to filter by the caller's `organization_id`, so that the "primary control" half of tenet M1/M2 is a verified fact rather than an assumption.

**Why this priority**: RLS (User Story 1) is a backstop; per M2 the application-layer filter remains the primary control. That control is only as good as an actual audit — the backlog item explicitly calls this out as "audited/reviewed against this feature, not assumed."

**Independent Test**: Can be fully tested by producing a review record (e.g., a checklist or report) covering every existing service-layer query against `organizations`, `teams`, `users`, `invitations`, and `api_keys`, with any gap found fixed before this feature is considered done.

**Acceptance Scenarios**:

1. **Given** every service-layer query written by this epic's prior features, **When** each is reviewed against this feature, **Then** each one that reads or writes a tenant-scoped row is confirmed to filter by the caller's `organization_id` (or, for `organizations` itself, by the caller's own organization identity).
2. **Given** a query is found during review that does not filter by `organization_id`, **When** the gap is identified, **Then** it is fixed as part of this feature rather than deferred.

---

### Edge Cases

- What happens when a resource ID belongs to another organization but otherwise looks identical to a valid same-org request (same request shape, just a foreign ID)? The system must deny it the same way regardless of whether the caller guessed the ID or obtained it some other way.
- How does the system respond when denying cross-organization access — does it reveal that a resource with that ID exists at all (e.g., a "forbidden" response) or treat it identically to a nonexistent ID ("not found")? See Assumptions.
- What happens to database migration, seeding, or other administrative tooling that must legitimately operate across all organizations — does row-level security block it too?
- What happens to an operation that must run before any organization context exists at all — resolving a login, session, or API key, redeeming an invitation token, or bootstrapping a brand-new organization's first team and admin — does row-level security block those too?
- What happens for a resource whose tenant ownership is indirect rather than a direct `organization_id` column (e.g., an invitation reachable only via its team)? Ownership must still resolve to the correct organization for the RLS policy and the test helper alike.
- What happens when the application-layer filter and the RLS policy disagree (e.g., app layer allows a query RLS would deny, or vice versa)? RLS is the backstop and its denial always wins — a session can never read or write a row it isn't entitled to, even if application code would have allowed it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce a row-level security policy on the `teams`, `users`, `invitations`, and `api_keys` tables, scoped by each row's `organization_id`, such that a database session scoped to one organization cannot read or write another organization's rows in these tables.
- **FR-002**: System MUST also enforce a row-level security policy on the `organizations` table itself, matching each row's own identity against the caller's organization context rather than an `organization_id` column (since this table has none — it defines the tenant boundary rather than living inside one). This reverses the exception previously documented in `005-org-tenant-model`'s data-model.md, which must be updated to reflect the new policy once implemented.
- **FR-003**: System MUST derive the row-level security policies' organization context from the same session-scoped mechanism already established for application-layer tenant scoping, rather than introducing a second, parallel mechanism for identifying the caller's organization.
- **FR-004**: Every existing service-layer query in this epic's already-implemented features MUST be reviewed and confirmed to filter reads and writes by the caller's `organization_id`; any query found not to do so MUST be corrected as part of this feature.
- **FR-005**: System MUST provide one reusable test helper, usable for any tenant-scoped resource type in any bounded context, that proves cross-organization access to a resource by its exact ID is denied.
- **FR-006**: For each tenant-scoped resource type owned by this bounded context (`organizations`, `teams`, `users`, `invitations`, `api_keys`), a test MUST use the shared helper to prove that a user authenticated to one organization cannot read or write a same-ID resource belonging to a different organization.
- **FR-007**: Tests MUST prove row-level security acts as an independent backstop: with the application-layer `organization_id` filter deliberately disabled or bypassed in a test scenario, the same cross-organization access attempt MUST still be denied.
- **FR-008**: Denial of cross-organization access by ID MUST be indistinguishable from the resource not existing at all — the system MUST NOT surface a distinct "forbidden" signal that would confirm to the caller that a resource with that ID exists in another organization.
- **FR-009**: The shared test helper MUST be documented with a usage example discoverable by an engineer who did not build it, so that later bounded-context epics can adopt it without re-deriving the pattern from this feature's implementation.
- **FR-010**: Row-level security policies MUST NOT block legitimate operations that must operate across organizations — both administrative tooling (schema migrations, seeding) and credential-resolution/tenant-bootstrap operations that necessarily run before any organization context is established (resolving a login by email, a session by token subject, an API key by hash, or an invitation by its redemption token; and creating the first organization/team/admin for a new tenant) — consistent with those operations running under a role distinct from the ordinary application runtime role.

### Key Entities

- **Organization**: The tenant boundary itself. Every other entity in this bounded context belongs to exactly one organization; its own row-level security policy matches on its own identity rather than a foreign `organization_id` column (FR-002).
- **Team**: Belongs to one organization; may itself be nested under a parent team within the same organization.
- **User**: An account belonging to one organization.
- **Invitation**: A pending invite to join a team, belonging to one organization (via its team).
- **API Key**: A credential belonging to one user within one organization.
- **Cross-tenant-denial test helper**: A shared, documented test utility (not itself a business entity) that any bounded context's tests can call to prove a given resource type denies cross-organization access by ID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of this bounded context's tenant-scoped tables have a row-level security policy in place, each verified by at least one passing automated test that attempts and fails a cross-organization read.
- **SC-002**: For every tenant-scoped resource type owned by this bounded context, at least one automated test proves cross-organization access by ID is denied — with that same test still passing when the application-layer organization filter is intentionally disabled, proving the database-level backstop works independently.
- **SC-003**: An engineer starting a tenant-isolation-tests feature in a later bounded-context epic can find, understand, and apply the shared test helper to a new resource type using only its documentation — without reading this feature's implementation or asking another engineer.
- **SC-004**: Zero service-layer queries remain, after this feature's audit, that read or write a tenant-scoped row without filtering by the caller's organization — any found during the audit are fixed before this feature is complete.

## Assumptions

- The session-scoped mechanism already used to carry the caller's organization context into the database (established in prior features of this epic) is reused as-is; this feature does not introduce a new context-passing mechanism, only the policies and tests that rely on it.
- "This epic's other features," per the audit requirement, refers to the already-implemented organization/tenant model, team hierarchy, user accounts, JWT session auth, invitations, and API keys features that precede this one in `002-identity-access`.
- Cross-organization denial is surfaced as equivalent to "not found," never a distinct "forbidden" response — chosen because confirming a resource's existence in another organization is itself information disclosure, and this matches the backlog's framing of proving denial "not just absent from list view" without specifying a different signal for direct access.
- Row-level security policies apply to the ordinary application runtime's database role. Database migration tooling, seed scripts, and any other administrative connection are expected to run under a separate, privileged role that is not subject to these policies — standard Postgres practice, and consistent with how schema changes are already applied in this project. That same separate-role approach also covers the small set of runtime (not administrative) operations that legitimately have no organization context yet — resolving a login/session/API-key/invitation-token, and bootstrapping a brand-new organization — rather than weakening the policies themselves to accommodate them.
- Tenant-scoped tables outside this bounded context (for example, any shared audit-logging table written to by this epic's features) are out of scope for this feature; this backlog item's requirements name only `organizations`, `teams`, `users`, `invitations`, and `api_keys`, and any other table's row-level security is that other table-owning context's responsibility.
- No end-user-facing behavior or UI changes result from this feature — it is a data-layer guarantee and a piece of shared developer-facing test infrastructure, verified entirely through automated tests.
