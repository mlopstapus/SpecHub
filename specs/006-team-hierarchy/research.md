# Research: Team Hierarchy

## 1. `owner_id` — no FK yet

**Decision**: `owner_id` is a nullable `uuid` with no foreign-key constraint for now.

**Rationale**: `identity_access.users` (the table `owner_id` would reference) doesn't exist yet — feature `003-user-accounts-and-registration` depends on this feature, not the reverse. Identical situation and resolution to `005-org-tenant-model`'s `plan_id`/`stripe_customer_id` (research.md §4).

**Alternatives considered**: Adding the FK now — not possible; Postgres would reject the migration against a nonexistent table.

## 2. Cycle detection strategy

**Decision**: Before committing a reparent, walk the *new parent's* ancestor chain (using the same traversal `getTeamChain` performs) and reject if the team being moved appears anywhere in it — that would mean the team is already an ancestor of its prospective new parent, i.e. the move would create a cycle.

**Rationale**: A cycle is created precisely when a team's descendant (direct or indirect) becomes its new parent. Walking the new parent's chain upward and checking membership is O(depth) and reuses the exact same query pattern `getTeamChain` already needs — no separate graph algorithm required. This mirrors the current Python `get_team_chain`'s own traversal shape (walk parent pointers, track `seen` to guard against pre-existing corruption), extended here to a *pre-write check* rather than only a read-time safety net.

**Alternatives considered**:
- A recursive CTE cycle check purely in SQL — rejected: adds a second, separate traversal implementation to maintain in parallel with `getTeamChain`'s TypeScript-side walk, for no correctness benefit at the shallow depths real organizational hierarchies have.
- Storing a materialized depth/path column (closure table) — rejected as over-engineering for this feature's scope; `context/database-conventions.md` doesn't establish this pattern elsewhere in the schema, and the simple parent-pointer model with a chain walk is sufficient at anticipated hierarchy depth.

## 3. Concurrency safety for reparenting

**Decision**: `reparentTeam` acquires a Postgres advisory transaction lock scoped to the organization (`pg_advisory_xact_lock(hash of organizationId)`) before performing the cycle check and the update, so two concurrent reparents within the same organization that could jointly create a cycle serialize instead of racing.

**Rationale**: Spec's Edge Case ("two reparent operations that would jointly create a cycle are attempted at the same time... exactly one succeeds") is a genuine TOCTOU race under `READ COMMITTED` otherwise — both transactions could read the pre-move hierarchy, both pass their independent cycle checks, and both commit, together producing a cycle neither check alone would have allowed. Locking per-organization (not globally, unlike `005-org-tenant-model`'s single global key) avoids serializing reparents across unrelated organizations, which no invariant here requires.

**Alternatives considered**:
- A single global advisory lock (mirroring `005-org-tenant-model`'s bootstrap lock) — rejected: that feature's invariant (at most one org, self-hosted only) is inherently a single global fact; this feature's invariant (no cycle) is scoped per-organization, so a global lock would serialize unrelated organizations' reparents for no reason, unlike `005-org-tenant-model` where self-hosted mode only ever has one organization to protect anyway.
- `SERIALIZABLE` isolation for the whole transaction — rejected: broader than needed; the only actual contention is the hierarchy shape within one organization.

## 4. `slug` uniqueness scope

**Decision**: `(organization_id, slug)` composite unique constraint, not a bare unique constraint on `slug` alone.

**Rationale**: FR-002 directly corrects the current Python schema's global `slug` uniqueness — the same class of bug PDR-003 exists to prevent (two different organizations both wanting a team named, e.g., "engineering"). `identity_access.organizations.slug` (from `005-org-tenant-model`) is uniquely constrained alone because it has no `organization_id` to scope by (it *is* the tenant root); `teams.slug` is the first table in this epic where the composite pattern applies.

**Alternatives considered**: Global uniqueness (today's behavior) — rejected; this is exactly the bug this feature is scoped to fix.

## 5. Test strategy

**Decision**: Same pattern as `005-org-tenant-model` — real Drizzle schema, a generated-and-renamed migration checked into `drizzle/migrations/`, tested via `startTestDb()`.

**Rationale**: `teams` is a permanent, real table other epics (Governance, via `getTeamChain`) depend on; no reason to deviate from the established, already-working pattern.

## 6. Characterization test against the current Python implementation

**Decision**: `getTeamChain`'s test suite includes at least one fixture hierarchy whose shape and expected output are derived by literally running the equivalent operation against the current Python `team_service.get_team_chain` (or by inspection of its logic, since it is a pure parent-pointer walk with no side effects) — confirming ordering (self-first, root-last) and exact entry count for a multi-level fixture.

**Rationale**: FR-007/SC-001 require the new implementation to match the current system's behavior exactly, since Governance's resolution correctness (an external, already-built consumer in the Python system) depends on this exact ordering per `bcs/identity-access/CONTRACT.md`'s Breaking Change Policy.

**Alternatives considered**: Trusting the ported logic without a direct comparison — rejected; "must match exactly" is a testable claim and should be tested as one, not asserted by code review alone.
