# Feature Specification: Organization Tenant Model

**Feature Branch**: `005-org-tenant-model`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "backlog/002-identity-access/001-organization-tenant-model.md — Introduce `Organization` as an explicit tenant-root aggregate above `Team`, per PDR-003. Self-hosted installs get exactly one `organizations` row, created at bootstrap; the managed SaaS gets many."

## Clarifications

### Session 2026-07-22

- Q: `bcs/identity-access/CONTRACT.md` lists `OrganizationCreated` as an event this feature's aggregate publishes, consumed later by Billing — does this feature need to publish/handle that event (e.g., wire an event bus, or make a synchronous call into Billing/Audit) as part of organization creation? → A: No. Per PDR-007, this system has no event bus or queue — all cross-context communication is synchronous in-process function calls. `CONTRACT.md`'s "Events Published" tables are documentation of what conceptually occurred, not a dispatch mechanism. Neither Billing (epic 008) nor Audit (epic 003) exist yet as bounded contexts, so there is nothing to call synchronously today. This feature creates the `Organization` row only; the synchronous call into this org-creation path is each future epic's own responsibility to add once its context exists.
- Q: The `organizations` table has an `updated_at` column, implying rows get modified after creation — should this feature include an update path for Organization fields (`name`, `slug`, `plan_id`, `stripe_customer_id`)? → A: No, creation-only. The one concrete update need identified — setting `plan_id`/`stripe_customer_id` once a plan is provisioned — belongs to the Billing epic's own feature (`backlog/008-billing-entitlements/001-plan-and-entitlement-model.md`, which already depends on this feature). No generic update API is built here.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-run bootstrap creates the tenant root (Priority: P1)

An operator stands up a brand-new self-hosted SkillCanon instance with an empty database and completes initial registration. That single action must produce exactly one Organization, one root Team, and one admin User, all created together — there is no separate "create your organization" step to forget or get wrong.

**Why this priority**: This is the foundational data shape every other bounded context depends on. Without a correct, atomic bootstrap, no org-scoped data anywhere in the system has a valid tenant root to point to.

**Independent Test**: Start with zero rows in `identity_access.organizations`, run first-run registration, and verify exactly one organization, one root team, and one admin user now exist, all referencing the same organization.

**Acceptance Scenarios**:

1. **Given** a fresh self-hosted install with zero organizations, **When** the first registration completes, **Then** exactly one `Organization`, one root `Team`, and one admin `User` exist, created in a single transaction.
2. **Given** the bootstrap transaction fails partway through (e.g., team or user creation errors after the organization row is written), **When** the transaction is rolled back, **Then** zero organizations remain — no partial state.

---

### User Story 2 - Self-hosted installs stay single-tenant (Priority: P2)

An operator (or a bug in calling code) attempts to create a second organization on a self-hosted install. The system must refuse, preserving the "Free = self-hosted only, one org per install" guarantee the business model depends on.

**Why this priority**: This is the enforcement half of the tenant model — without it, a self-hosted install could silently drift into a multi-org state it was never designed or licensed for.

**Independent Test**: On a self-hosted install that already has one organization, attempt to create a second one and verify it is rejected before any row is written.

**Acceptance Scenarios**:

1. **Given** a self-hosted install with one existing organization, **When** a second organization creation is attempted, **Then** the application layer rejects the request and no new organization row is written.

---

### User Story 3 - Organization identity stays unique and unambiguous (Priority: P3)

Every organization has a unique `slug` that other systems (URLs, external references) can rely on to unambiguously identify it, even under concurrent creation attempts.

**Why this priority**: Matters most once SaaS has multiple organizations; still valuable on day one because it establishes the constraint before any data exists to violate it, per PDR-003's "correct from day one" rationale.

**Independent Test**: Attempt to create two organizations with the same slug and verify the second is rejected.

**Acceptance Scenarios**:

1. **Given** an organization with slug `acme` already exists, **When** a second organization creation with slug `acme` is attempted, **Then** the attempt is rejected due to a uniqueness constraint enforced at the database level.
2. **Given** two organization-creation attempts with the same slug arrive concurrently, **When** both transactions attempt to commit, **Then** only one succeeds and the other fails cleanly (no duplicate slugs ever persist, regardless of timing).

---

### Edge Cases

- What happens when the bootstrap transaction fails partway (team or user creation errors after the organization row is written)? The entire transaction rolls back — no organization, team, or user persists.
- What happens when two first-run bootstrap attempts race concurrently against an empty database? Exactly one succeeds in creating the organization; the other must fail rather than produce a second tenant root.
- What happens when `plan_id` has no value because the billing bounded context doesn't exist yet? The column accepts `NULL` and the organization is otherwise fully functional.
- What happens when another bounded context tries to read organization data? It only ever receives the `OrgSummary` shape via `getOrganization(organizationId)` — never the raw row or direct table access.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an `organizations` table (owned by the identity & access bounded context) with `id`, `name`, `slug`, `plan_id`, `stripe_customer_id`, `created_at`, and `updated_at`.
- **FR-002**: System MUST enforce uniqueness of `organizations.slug` at the database level (not application-layer-only).
- **FR-003**: System MUST allow `plan_id` and `stripe_customer_id` to be absent (nullable), since no billing bounded context exists yet.
- **FR-004**: On first run with zero existing organizations, the system MUST create exactly one `Organization`, one root `Team`, and one admin `User` together in a single atomic transaction. This feature delivers the transactional mechanism (an injected, composable creation step); full end-to-end delivery — real `Team`/`User` rows rather than a stub — completes once features 002 (Team Hierarchy) and 003 (User Accounts & Registration) supply the real implementation (see Assumptions).
- **FR-005**: This bootstrap behavior MUST replace the current behavior that conflates organization creation with root-team creation.
- **FR-006**: In self-hosted mode, the system MUST reject any attempt to create a second `Organization`, before any row is written.
- **FR-007**: System MUST expose organization data to other bounded contexts only through a `getOrganization(organizationId)` read operation returning the `OrgSummary` shape (`id`, `name`, `slug`, `planId`) — never the raw row or direct table access.
- **FR-008**: Every query helper that operates on organization-scoped data MUST require `organizationId` as a mandatory argument — it MUST NOT be an optional filter.
- **FR-009**: This feature MUST implement organization creation and reads only; it MUST NOT implement an update path for `name`, `slug`, `plan_id`, or `stripe_customer_id`, and MUST NOT implement or depend on any event-bus/queue dispatch for `OrganizationCreated` — cross-context reaction to organization creation (Billing provisioning a plan, Audit recording the mutation) is out of scope here and is each consuming context's own future feature to add as a synchronous call into this path.

### Key Entities

- **Organization**: The tenant-root aggregate. Every organization-scoped row across every bounded context ultimately traces back to one `Organization` via `organization_id`. Attributes: unique identifier, display name, unique slug, optional billing plan pointer, optional payment-processor customer reference, creation/update timestamps. A self-hosted install has exactly one; the managed SaaS has many.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A fresh self-hosted install completes first-run bootstrap — organization, root team, and admin user all present and correctly linked — as a single verified operation, with zero manual database setup steps required. (This feature verifies the transactional mechanism via a stub team/user step; the fully-real-rows version of this criterion is verified once features 002/003 land — see FR-004.)
- **SC-002**: 100% of attempts to create a second organization on a self-hosted install are rejected before any write occurs.
- **SC-003**: 100% of organization slug collisions are rejected at the data layer, including under concurrent creation attempts.
- **SC-004**: Every other bounded context retrieves organization data exclusively through the summary read contract — zero direct cross-context reads of the raw `organizations` table.

## Assumptions

- Whether a running instance is "self-hosted" or "managed SaaS" is determined by existing application-level configuration; defining that mode switch itself is out of scope for this feature.
- `plan_id` and `stripe_customer_id` remain nullable until the billing & entitlements bounded context exists (a later epic); this feature only reserves the columns.
- The internal shape and hierarchy semantics of the root `Team` created during bootstrap are covered by the Team Hierarchy feature; this feature treats it as an opaque row linked to the new Organization.
- The internal shape of the admin `User` created during bootstrap (credentials, password policy) is covered by the User Accounts & Registration feature; this feature only guarantees it is created atomically alongside the Organization and root Team.
- "Rejected" for a disallowed second-organization attempt means a clear application-level error is returned to the caller, not a silent no-op.
- There is no event bus or async dispatch in this system (PDR-007) — `CONTRACT.md`'s "Events Published" table documents what conceptually occurred, it is not a mechanism this feature implements. Organization creation does not currently trigger any synchronous call into another bounded context, because neither Billing (epic 008) nor Audit (epic 003) exist yet.
- Setting `plan_id`/`stripe_customer_id` after a plan is provisioned, and writing an audit log entry for organization creation, are forward dependencies owned by the Billing and Audit epics respectively, not this feature — see `backlog/008-billing-entitlements/001-plan-and-entitlement-model.md` (already depends on this feature and lists the provisioning requirement) and `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md` (updated to flag retrofitting this epic's mutations once its write path exists).
