# Testing Strategy

**Status:** Decided
**Decided:** 2026-07-21
**Backlog item:** `backlog/000-foundations/003-testing-strategy.md`

## Runner and file convention

**Vitest** for unit and integration tests, **Playwright** for e2e. Test files are colocated: `foo.ts` → `foo.test.ts` in the same folder. Colocated over a parallel `tests/` tree because it keeps a BC's public/private boundary (see `context/repo-structure.md`) visible alongside its tests, and matches Vitest's default discovery with zero config.

## Unit vs. integration vs. e2e

| Level | Scope | Example |
|---|---|---|
| Unit | Pure domain logic, no DB, no network | Governance resolver's merge/priority logic, given a fake team-chain array |
| Integration | Hits a real test Postgres instance, within one BC | A BC's application-service function, asserting the right rows land in its schema, RLS included |
| E2E | Full HTTP/MCP round trip, Playwright | `sh-run` over MCP end-to-end; a REST flow through the actual Next.js server |

RLS specifically cannot be meaningfully unit-tested with a mock — it needs a real Postgres connection with RLS enabled. This is exactly what pushes RLS testing into the integration tier.

## Red-green-iterate workflow

Tenet P1 makes this mandatory for all new backend logic, not optional discipline — it's the only correctness signal available given there's no static type checker beyond what TypeScript itself catches. The cycle, concretely:

1. **Red** — write a test that demonstrates the requirement and fails for the right reason (run it, confirm it fails on the assertion, not on a typo or missing import). For tenant-scoped logic, this is where the M1 scoping question gets asked at design time — "which org does this belong to, and what happens if the caller isn't in it" — instead of being retrofitted after a bug report.
2. **Green** — write the minimum code to pass that one test. Not the general solution, not the next test's case — just enough to turn this test green.
3. **Iterate** — refactor (rename, extract, remove duplication) with the suite green throughout; if a refactor needs new behavior, that's a new red test, not a change hiding inside a "refactor."

This applies at the unit and integration tiers (see above) — e2e tests validate the assembled behavior afterward, they aren't where red-green-iterate happens. A PR introducing new backend logic without a preceding failing test that demonstrates the requirement doesn't satisfy P1, regardless of whether the final code is correct.

**M3 in practice:** for any new tenant-scoped resource type, the red-green cycle includes at least one negative test using `assertCrossTenantDenied` (above) before the resource's read/write path is considered done — this is the concrete point where P1 and M3 meet, per the tenet's own rationale.

## Test database strategy

**Testcontainers**, spinning up a real ephemeral Postgres per test run (or per CI job), with `drizzle-kit push` applying the current schema at container start. Chosen over a shared, reset-between-runs schema because RLS correctness (tenet M2) requires a real Postgres instance and Testcontainers keeps that isolated and parallelizable, at the cost of slightly slower CI cold-start (acceptable — this isn't the interactive dev loop).

## The M3 cross-tenant-denial pattern

A shared test utility, built once in epic `002-identity-access` (where the tenant model is established) and reused by every subsequent BC epic:

```ts
// shared/testing/tenant-isolation.ts
export async function assertCrossTenantDenied(opts: {
  actingAsOrg: OrganizationId;
  resourceOwnedByOrg: OrganizationId;
  fetchResourceById: (id: string) => Promise<Response | unknown>;
  resourceId: string;
}) {
  // asserts a 404/403 when actingAsOrg tries to read/write resourceId,
  // which belongs to resourceOwnedByOrg — never merely "absent from list view"
}
```

Every BC epic's own `tenant-isolation-tests` feature calls this helper once per resource type it owns, satisfying tenet M3.

**Delivered** in `011-tenant-isolation-rls` as `src/shared/testing/tenant-isolation.ts` — the real signature takes plain `string` organization/resource ids (no `OrganizationId` branded type exists in this codebase), and denial means "throws, or resolves to a falsy/empty result" (covers both a thrown not-found error and an empty list). Usage example, combining an app-layer check with an RLS-alone check in the same call:

```ts
import { withTenantContext } from "@/shared/db/tenant-context";
import { assertCrossTenantDenied } from "@/shared/testing/tenant-isolation";
import { getUser } from "@/bcs/identity-access";

// App-layer denial (M1): the function's own organizationId check.
await assertCrossTenantDenied({
  actingAsOrg: orgA.id,
  resourceOwnedByOrg: orgB.id,
  resourceId: userInOrgB.id,
  fetchResourceById: (id) =>
    withTenantContext(testDb.appDb, orgA.id, (tx) => getUser(tx, id, orgA.id)),
});

// RLS-alone denial (M2 backstop, FR-007): no app-layer filter in the query
// at all — only the session-scoped RLS policy stands between orgA's
// connection and orgB's row.
await assertCrossTenantDenied({
  actingAsOrg: orgA.id,
  resourceOwnedByOrg: orgB.id,
  resourceId: userInOrgB.id,
  fetchResourceById: (id) =>
    withTenantContext(testDb.appDb, orgA.id, (tx) =>
      tx.select().from(users).where(eq(users.id, id)),
    ),
});
```

See `specs/011-tenant-isolation-rls/contracts/tenant-isolation-test-helper.md` for the full contract.

## Characterization tests for the Python port

For behavior being ported from the current Python implementation (governance resolution, prompt expansion): run a fixed set of representative inputs through the current Python service, record the outputs as fixtures, then assert the new TypeScript implementation produces identical outputs before considering that piece of the port done. These fixtures live alongside the new implementation's test file, not in a separate "legacy" folder.

## Deliverable status

Runner, unit/integration/e2e boundaries, test-database approach, and the M3 pattern are settled. Every feature file from epic 002 onward references this document rather than re-deriving test conventions.
