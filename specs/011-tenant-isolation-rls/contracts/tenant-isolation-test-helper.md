# Contract: `assertCrossTenantDenied` shared test helper

New module: `src/shared/testing/tenant-isolation.ts`. This is the concrete implementation of the pattern `context/testing-strategy.md`'s "The M3 cross-tenant-denial pattern" section already sketches — this feature is that section's own delivery, not a new design (FR-005/FR-009).

## Signature

```ts
export async function assertCrossTenantDenied(opts: {
  actingAsOrg: string;
  resourceOwnedByOrg: string;
  fetchResourceById: (id: string) => Promise<unknown>;
  resourceId: string;
}): Promise<void>;
```

- `fetchResourceById` is called with `resourceId` and is expected to either throw or resolve to a falsy/empty result — anything else fails the assertion, with a message naming which organization was expected to be denied.
- Deliberately generic (`(id) => Promise<unknown>`) so the same helper covers both call shapes this feature needs:
  1. **App-layer denial** — `fetchResourceById` wraps a real application function, e.g. `(id) => getUser(tx, id, actingAsOrg)`.
  2. **RLS-alone denial** — `fetchResourceById` wraps a raw Drizzle query with no app-layer org filter at all, run inside a transaction already scoped to `actingAsOrg` via `withTenantContext`, e.g. `(id) => tx.select().from(users).where(eq(users.id, id)).then(rows => rows[0])`. This is what proves FR-007 — the RLS backstop working independently of the app-layer check.

## Usage example (mirrors what ships in `context/testing-strategy.md`)

```ts
import { withTenantContext } from "@/shared/db/tenant-context";
import { assertCrossTenantDenied } from "@/shared/testing/tenant-isolation";
import { getUser } from "@/bcs/identity-access";

await assertCrossTenantDenied({
  actingAsOrg: orgA.id,
  resourceOwnedByOrg: orgB.id,
  resourceId: userInOrgB.id,
  fetchResourceById: (id) =>
    withTenantContext(testDb.appDb, orgA.id, (tx) => getUser(tx, id, orgA.id)),
});
```

## Where it's documented for reuse

A short usage example (the same one above, or a close variant) is added to `context/testing-strategy.md`'s existing "M3 cross-tenant-denial pattern" section (FR-009) — not just this feature's own test files — so `004-governance`, `005-prompt-registry`, and `006-workflow-orchestration`'s own tenant-isolation-tests features can find and apply it without reading this feature's implementation.

## Stability

Per `CLAUDE.md`'s standing guidance on this exact helper: treat its signature as a mini-contract of its own. Every subsequent epic's tenant-isolation-tests feature imports it; changing its shape later means updating every epic that imports it.
