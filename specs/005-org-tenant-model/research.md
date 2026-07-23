# Research: Organization Tenant Model

## 1. Self-hosted vs. managed-SaaS mode detection

**Decision**: Reuse the existing `STRIPE_ENABLED` env var (`process.env.STRIPE_ENABLED !== "true"` ⇒ self-hosted) rather than introduce a new flag.

**Rationale**: `context/deployment.md` already establishes this as the single mechanism distinguishing the two deployment shapes: "one build artifact, `STRIPE_ENABLED=false` and Free-tier entitlements hardcoded for self-host, the identical code path otherwise." Introducing a second, competing flag (e.g. `DEPLOYMENT_MODE`) would create ambiguity about which one is authoritative.

**Alternatives considered**:
- A new dedicated `DEPLOYMENT_MODE=self-hosted|saas` env var — rejected: duplicates an already-decided mechanism, and nothing in the codebase reads it, so it would be this feature inventing a second source of truth.
- Inferring mode purely from `organizations` row count (0 or 1 ⇒ self-hosted) — rejected: doesn't actually distinguish *intent*. A SaaS deployment legitimately starts with zero, then one, then many orgs; row count alone can't tell "single-tenant by design" from "multi-tenant that just hasn't onboarded its second customer yet."

**Where it lives**: `src/bcs/identity-access/domain/deployment-mode.ts`, read directly via `process.env`, not through `shared/config` — `shared/config` is Distribution's owned module (`bcs/identity-access/OWNERSHIP.md` claims no shared resources), and no existing convention mandates routing all env reads through it. If a second bounded context needs this same check later, consolidating into `shared/config` is a small, low-risk follow-up for whoever owns that need next — not solved preemptively here (matching PDR-007's own pattern of flagging rather than pre-solving).

## 2. Composing Organization + Team + admin User creation atomically

**Decision**: `bootstrapOrganization(db, params, provisionTeamAndAdmin)` takes the Team/User creation step as an injected callback `(tx, organizationId) => Promise<{ teamId: string; userId: string }>`, run inside the same transaction as the Organization insert. This feature's own tests supply a stub callback to prove the transaction's atomicity (a throwing stub rolls back the Organization insert too); the real callback — actual `identity_access.teams`/`identity_access.users` row creation — is supplied at the real call site once features 002 (Team Hierarchy) and 003 (User Accounts & Registration) exist.

**Rationale**: `backlog/002-identity-access/001-organization-tenant-model.md` (this feature) has no dependency on `002-team-hierarchy.md` or `003-user-accounts-and-registration.md` — the dependency graph runs the other way (both declare a dependency *on* this feature). Neither the `teams` nor `users` table exists yet. `CLAUDE.md`'s own backlog convention anticipates exactly this shape: "If an item's own Acceptance Criteria aren't all met yet (e.g. one is blocked on a separate not-yet-built backlog item), leave `status: open` and don't archive it — check off only what's actually true." FR-004's full behavior and SC-001 are therefore only fully verifiable once 002/003 land and wire the real callback at the registration route handler; this feature delivers the transactional mechanism and the Organization-only slice, verified independently.

**Alternatives considered**:
- Build minimal/stub `teams` and `users` tables now, let 002/003 `ALTER TABLE` them later — rejected: those features each specify a full table definition as if creating it fresh (not "add columns to an existing table"), so pre-creating stub tables would fight their own migrations rather than compose with them.
- Defer the transaction-composability question entirely to feature 003 — rejected: FR-004 ("single atomic transaction") is a mechanism decision that belongs with the Organization-creation code that opens the transaction in the first place; feature 003 should be able to import and reuse `bootstrapOrganization`, not reinvent transaction plumbing.

## 3. Concurrency safety for the self-hosted single-org guard

**Decision**: `bootstrapOrganization` acquires a Postgres advisory transaction lock (`pg_advisory_xact_lock(<constant>)`) before counting existing organizations and inserting, so two concurrent first-run attempts serialize instead of racing.

**Rationale**: The guard is explicitly application-layer only per the backlog item itself ("Application-layer guard: self-hosted mode refuses to create a second Organization") — a DB-level constraint capping the table at one row is impossible without also breaking SaaS mode, which legitimately holds many rows in the exact same table. An advisory lock is the standard idiomatic Postgres pattern for "serialize this specific operation across concurrent transactions" without a schema-level constraint, directly resolving spec's Edge Case: "two first-run bootstrap attempts race concurrently against an empty database... exactly one succeeds."

**Alternatives considered**:
- Plain count-then-insert with no lock — rejected: a genuine TOCTOU race under `READ COMMITTED` (Postgres's default) lets both transactions see zero rows and both insert.
- `SERIALIZABLE` isolation for the whole transaction — rejected: broader and costlier than needed; the only actual contention is "how many organizations exist," which the advisory lock protects precisely.

## 4. `plan_id` / `stripe_customer_id` — no DB-level FK yet

**Decision**: Both columns are nullable `uuid`/`text` with no foreign-key constraint for now.

**Rationale**: `billing.plans` (the target table `plan_id` would reference) doesn't exist — Billing & Entitlements is epic 008, not yet built. Per `bcs/identity-access/OWNERSHIP.md`, these are described as "foreign-key pointers into Billing's schema" conceptually; the actual DB constraint is added once that table exists (tracked in `backlog/008-billing-entitlements/001-plan-and-entitlement-model.md`, which already lists this feature as a dependency).

**Alternatives considered**: Adding the FK now against a not-yet-existent table — not possible; Postgres would reject the migration outright.

**Open flag for epic 008**: `backlog/008-billing-entitlements/001-plan-and-entitlement-model.md`'s actual entitlement-resolution design reads from its own `billing.entitlements`/`billing.plans` tables (keyed by `organization_id`), and `002-stripe-checkout-and-subscription-sync.md` stores `stripe_customer_id` on `billing.subscriptions` — neither currently plans to write back to `organizations.plan_id`/`stripe_customer_id`. These two columns may end up unpopulated by any real feature as currently scoped. Not a blocker here (they stay nullable regardless), but worth resolving — either have a future billing feature populate them, or drop them — before epic 008's schema is finalized.

## 5. Test strategy

**Decision**: Real Drizzle schema + a generated migration checked into `drizzle/migrations/`, tested via the existing `startTestDb()` helper (`src/shared/db/test-helpers.ts`), which applies real migrations to an ephemeral Testcontainers Postgres instance — matching `tenant-context.test.ts`/`with-audit.test.ts`'s pattern, not `columns.test.ts`'s throwaway-table approach (that pattern is for testing generic column builders in isolation, not a real persistent BC table).

**Rationale**: `organizations` is a permanent table this and every later epic depends on; it needs to exist via the same migration path production deployments use (`pnpm db:migrate`), not be synthesized ad hoc per test run.
