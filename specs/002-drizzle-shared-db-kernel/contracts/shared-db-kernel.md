# Contract: `src/shared/db` public API

This feature has no REST or MCP surface of its own — its "external interface" is the TypeScript module contract every bounded context codes against (`@/shared/db`). Anything not listed here and not re-exported from `index.ts` is private to the kernel and MUST NOT be imported directly by a BC (matching the barrel-only import convention in `context/repo-structure.md`).

## Exported from `src/shared/db/index.ts`

```ts
// client.ts
export const db: PostgresJsDatabase; // Drizzle client bound to the runtime (least-privileged) app role

// schemas.ts
export const SCHEMAS: {
  identityAccess: "identity_access";
  governance: "governance";
  promptRegistry: "prompt_registry";
  workflow: "workflow";
  billing: "billing";
  audit: "audit";
  distribution: "distribution";
};

// columns.ts
export function id(): ReturnType<typeof uuid>; // primary key, gen_random_uuid() default
export function organizationId(): ReturnType<typeof uuid>; // NOT NULL, FK-shaped to identity_access.organizations.id
export function timestamps(): { createdAt: ...; updatedAt: ... };

// tenant-context.ts
export function withTenantContext<T, TSchema extends Record<string, unknown> = Record<string, never>>(
  db: PostgresJsDatabase<TSchema>,
  organizationId: string,
  fn: (tx: DrizzleTransaction<TSchema>) => Promise<T>
): Promise<T>;
// Opens a transaction, issues select set_config('app.current_org_id', organizationId, true)
// (the parameterizable equivalent of SET LOCAL — Postgres's SET statement
// does not accept bind parameters), runs fn with that transaction,
// commits/rolls back around it. Callable identically from REST route
// handlers and MCP tool handlers. Takes `db` as an explicit parameter
// (rather than closing over the shared client) so it also works against a
// Testcontainers instance in integration tests.

// with-audit.ts
export function withAudit<T, TSchema extends Record<string, unknown> = Record<string, never>>(
  db: PostgresJsDatabase<TSchema>,
  mutationFn: (tx: DrizzleTransaction<TSchema>) => Promise<T>,
  auditWriteFn: (tx: DrizzleTransaction<TSchema>) => Promise<unknown>
): Promise<T>;
// Runs mutationFn then auditWriteFn in one transaction — either both commit
// or neither does. auditWriteFn is a required argument, not optional —
// there is no call shape that performs the mutation without also
// attempting the audit write. It's a caller-supplied thunk (not a plain
// audit-event value withAudit inserts itself) because the real
// `audit.audit_events` table's shape is owned by Audit & Compliance's own
// future epic, not this shared kernel.
```

## Consumer expectations

| Caller | Must do | Must not do |
|---|---|---|
| Any BC's `infrastructure/` layer | Import `db`, `SCHEMAS`, `id`/`organizationId`/`timestamps` from `@/shared/db` to define its own schema file | Redefine its own connection, pool, or standard columns |
| Any BC's `application/` layer performing a tenant-scoped read/write | Wrap the unit of work in `withTenantContext(db, organizationId, fn)` | Query a tenant-scoped table outside of an established tenant context |
| Any BC's `application/` layer performing a mutation | Wrap it in `withAudit(db, mutationFn, auditWriteFn)`, with `auditWriteFn` performing the real audit insert once Audit & Compliance's table exists | Call a raw mutation against a tenant-scoped table directly (flagged in review per constitution Principle VI) |
| `src/app/api/**` (REST) and `src/app/mcp/**` (MCP) route/tool handlers | Resolve the caller's organization, then call into a BC's application-service function that itself uses `withTenantContext` | Set `app.current_org_id` directly via raw SQL, bypassing the helper |

## Stability guarantees

- `SCHEMAS` keys are stable once a BC epic starts building tables in that schema — renaming a key is a breaking change requiring the same BC's migration to be updated in lockstep.
- `withTenantContext` and `withAudit`'s function signatures are the contract every future BC epic is written against; changing their shape (e.g., making `auditWriteFn` optional) would silently defeat PDR-005's guarantee and requires a PDR, not a routine refactor.

## Out of scope for this contract

- Any BC's own domain tables, schema files, or application-service functions — those are each BC epic's own contract (`bcs/<name>/CONTRACT.md`).
- The real `audit.audit_events` table shape — owned by Audit & Compliance's own future epic; this feature's tests use a throwaway table only (see `data-model.md`).
