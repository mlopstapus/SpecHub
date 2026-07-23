# Feature Specification: Team Hierarchy

**Feature Branch**: `006-team-hierarchy`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "backlog/002-identity-access/002-team-hierarchy.md — Port the recursive team hierarchy (`teams.parent_team_id`, `sub_teams`, `get_team_chain`) from the current Python `team_service.py`, scoped under `Organization` instead of being the tenant root itself. `getTeamChain` is a stability-guaranteed contract function per `bcs/identity-access/CONTRACT.md` — Governance's resolution correctness depends on its ordering never changing."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build an organization's team structure (Priority: P1)

An administrator creates teams within their organization and organizes them into a hierarchy — some teams standing alone at the top level, others nested under a parent team, mirroring how the organization is actually structured (e.g., "Engineering" containing "Platform" and "Product").

**Why this priority**: Without the ability to create and list teams scoped to an organization, no hierarchy exists to resolve or govern — this is the foundational data shape every other story in this feature builds on.

**Independent Test**: Create several teams in one organization, some nested under others, and verify each is retrievable individually and listable as a sub-team of its parent (or as a root-level team if it has none).

**Acceptance Scenarios**:

1. **Given** an organization with no teams, **When** a team is created with no parent, **Then** it exists as a root-level team in that organization.
2. **Given** an existing team in an organization, **When** a second team is created with the first as its parent, **Then** the second team is listed among the first team's sub-teams.
3. **Given** an existing team, **When** its name, description, or owner is updated, **Then** the change is reflected and its position in the hierarchy is unchanged.

---

### User Story 2 - Resolve a team's full lineage (Priority: P2)

Another bounded context (Governance) needs to know, for a given team, the complete chain of authority above it — itself, then its parent, then its parent's parent, all the way to the root — so it can resolve which policies and objectives apply.

**Why this priority**: This is the stability-guaranteed read contract other bounded contexts depend on today (per `bcs/identity-access/CONTRACT.md`) — its correctness and exact ordering matter as much as team creation itself, and nothing downstream can resolve governance correctly without it.

**Independent Test**: Build a multi-level hierarchy (grandparent → parent → child), request the chain for the child, and verify the result is ordered child-first, root-last, with no extra or missing entries.

**Acceptance Scenarios**:

1. **Given** a four-level team hierarchy, **When** the chain is requested for the bottom-most team, **Then** all four teams are returned in order from itself up to the root.
2. **Given** a root-level team with no parent, **When** its chain is requested, **Then** only that one team is returned.
3. **Given** the same hierarchy shape as today's system, **When** its chain is requested, **Then** the result matches today's equivalent operation exactly, entry for entry.

---

### User Story 3 - Reorganize teams without corrupting the hierarchy (Priority: P3)

An administrator moves an existing team to sit under a different parent team as the organization's structure changes — and the system must refuse any move that would silently break the hierarchy, whether by attaching to a team in a different organization or by creating a loop where a team is, directly or indirectly, its own ancestor.

**Why this priority**: Reorganization is expected to happen after teams already exist and matter (lower priority than creation and resolution), but a broken hierarchy — a cross-organization link or a cycle — is a correctness failure serious enough that Governance's chain resolution (User Story 2) could infinite-loop or leak across tenants, so protecting it is not optional once reparenting exists at all.

**Independent Test**: Attempt to reparent a team under a team from a different organization, and separately attempt to create a cycle (make a team's own descendant its new parent) — verify both are rejected and the hierarchy is unchanged.

**Acceptance Scenarios**:

1. **Given** a team in organization A and a team in organization B, **When** an administrator attempts to reparent A's team under B's team, **Then** the request is rejected and neither team's parent changes.
2. **Given** team X is the parent of team Y, **When** an administrator attempts to reparent X under Y, **Then** the request is rejected because it would create a cycle.
3. **Given** a valid reparent (same organization, no cycle), **When** it succeeds, **Then** the team's chain (User Story 2) reflects the new lineage immediately.

---

### User Story 4 - Insert a new team into an existing hierarchy (Priority: P4)

An administrator introduces a new intermediate team between an existing team and its current parent — for example, adding a "Backend" team between "Platform" and "Engineering" — without manually reparenting the existing team by hand.

**Why this priority**: This is a convenience composition of team creation and reparenting (User Stories 1 and 3) rather than a new primitive — valuable, but the lowest priority since both underlying operations must already exist and be correct first.

**Independent Test**: Given an existing team with a parent, insert a new team "between" them and verify the new team is now the existing team's parent, and the new team's parent is the existing team's former parent.

**Acceptance Scenarios**:

1. **Given** team Y with parent team Z, **When** a new team is inserted between Y and Z, **Then** the new team's parent is Z, and Y's parent becomes the new team.
2. **Given** a request to insert between a team and a nonexistent target team, **When** the operation is attempted, **Then** it is rejected with a clear error and no team is created.

---

### Edge Cases

- What happens when a root-level team (no current parent) is reparented under another team? It succeeds like any other valid reparent — the team simply stops being root-level, subject to the same organization and cycle checks.
- What happens when a reparent attempt targets the team's own current parent (a no-op move)? It succeeds trivially — no hierarchy change occurs, but it is not treated as an error.
- What happens when two reparent operations that would jointly create a cycle are attempted at the same time (e.g., A→under-B and B→under-A submitted concurrently)? Exactly one succeeds; the other is rejected as if it had been submitted second, and no cycle is ever visible even momentarily.
- What happens when `getTeamChain` is requested for a team that doesn't exist? A clear "not found" error, not an empty or partial chain.
- What happens when insert-between is requested on a team that has no current parent (is root-level)? The new team becomes the new root (taking the "no parent" position), and the existing team is reparented under it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an `identity_access.teams` table scoped to one `organization_id`, with `id`, `name`, `slug`, `description`, an optional `owner_id`, an optional `parent_team_id` (self-referential), and creation/update timestamps.
- **FR-002**: System MUST enforce team `slug` uniqueness scoped per organization (not globally), correcting the current system's global uniqueness — matching the multi-tenancy correction PDR-003 established for other identifiers.
- **FR-003**: System MUST allow creating a team within an organization, optionally specifying an existing team in the same organization as its parent.
- **FR-004**: System MUST allow updating a team's name, description, and owner.
- **FR-005**: System MUST allow listing a team's immediate sub-teams, and listing an organization's root-level (parentless) teams.
- **FR-006**: System MUST provide a chain-resolution operation that, given a team, returns the ordered list of that team and every ancestor up to the root — itself first, root last.
- **FR-007**: The chain-resolution operation's ordering behavior MUST match the current system's equivalent operation exactly, for an equivalent hierarchy shape.
- **FR-008**: System MUST allow reparenting an existing team to a different parent team.
- **FR-009**: Reparenting MUST reject any attempt where the new parent belongs to a different organization than the team being moved — no row changes when rejected.
- **FR-010**: Reparenting MUST reject any attempt that would make a team a direct or indirect ancestor of itself — no row changes when rejected.
- **FR-011**: System MUST allow inserting a new team between an existing team and its current parent (or current root position) — the new team assumes the existing team's former parent position, and the existing team is reparented under the new team.
- **FR-012**: The organization-boundary and cycle-prevention invariants (FR-009, FR-010) MUST be enforced identically regardless of which transport (REST route, MCP tool) initiates the request — implemented once in the shared application layer, not duplicated per transport.
- **FR-013**: This feature MUST NOT implement team deletion/deactivation — not listed in this feature's scope; a hard-delete or archive operation, if ever needed, is a separate future decision.
- **FR-014**: This feature MUST NOT implement authorization/permission checks for who may create, update, or reparent a team — those depend on `identity_access.users`/roles and session authentication, neither of which exist yet (features 003/004 of this same epic); this feature's functions accept an already-authorized caller as a given, and the future route/tool that calls them is responsible for the actual permission check.
- **FR-015**: This feature MUST NOT implement or depend on any event-bus/queue dispatch for team reparenting — per PDR-007 (no event bus exists in this system); recording a reparent for Audit's benefit is a forward dependency owned by the Audit & Compliance epic, not built here (see Assumptions).

### Key Entities

- **Team**: A node in an organization's hierarchy. Attributes: unique identifier, the organization it belongs to, display name, unique-per-organization slug, optional description, optional owning user, optional parent team (another Team in the same organization). Every team ultimately traces to a root-level team (no parent) within its organization.
- **TeamChainEntry**: A read-only projection of one team as it appears in a resolved chain — id, name, and its own parent's id (or none if root). The ordered sequence of these, self-first and root-last, is `getTeamChain`'s stability-guaranteed output shape per `bcs/identity-access/CONTRACT.md`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any team hierarchy shape, the chain-resolution operation returns the exact same self-first, root-last sequence as the current system's equivalent operation, verified automatically against an equivalent multi-level fixture.
- **SC-002**: 100% of attempts to reparent a team under a different organization's team are rejected, with zero partial or silent state changes.
- **SC-003**: 100% of attempts to reparent a team in a way that would create a cycle are rejected, including when two conflicting reparent attempts happen at the same time.
- **SC-004**: Inserting a new team between an existing team and its parent leaves every other team in the hierarchy completely unaffected — only the two teams directly involved change.

## Assumptions

- Team deletion/deactivation is out of scope (FR-013) — the source backlog item's Requirements list only create, update, reparent, and list operations.
- Authorization for who may perform these operations is out of scope (FR-014) — it depends on user roles and session auth, neither of which this epic has built yet; this feature's functions trust an already-authorized caller.
- `owner_id` remains nullable with no foreign-key constraint yet — `identity_access.users` doesn't exist until feature `003-user-accounts-and-registration`, which depends on this feature rather than the reverse. Same pattern already established for `identity_access.organizations.plan_id` in `specs/005-org-tenant-model/`.
- Per PDR-007, there is no event bus in this system — `bcs/governance/CONTRACT.md`'s note that "Audit reacts to `TeamReparented`" describes what conceptually occurs, not a dispatch mechanism this feature builds. Writing an audit row for a reparent is a forward dependency of the Audit & Compliance epic (already tracked in `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`, extended to note this feature's mutations too), not something built here — same resolved question as `specs/005-org-tenant-model/`'s Clarifications.
- This feature builds the identity-access application-layer functions only (`createTeam`, `updateTeam`, `reparentTeam`, `insertTeamBetween`, `getTeamChain`, sub-team listing) — no REST route or MCP tool is added by this feature itself; `bcs/identity-access/CONTRACT.md` already lists `createTeam` as a function Distribution's future route handlers call, not something exposed as an HTTP endpoint here.
- Concurrent reparent attempts that could jointly create a cycle are prevented by the same transaction-scoped mechanism (not necessarily identical in implementation) already used for `identity_access.organizations`' single-row guard in `specs/005-org-tenant-model/` — a concrete locking strategy is a planning-phase decision, not a scope question.
