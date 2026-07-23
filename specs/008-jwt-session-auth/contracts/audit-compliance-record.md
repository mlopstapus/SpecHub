# Contract: Audit & Compliance — Write path (pulled forward from `003-audit-compliance/001`)

This feature adds the following to `src/bcs/audit-compliance/index.ts`, completing (not superseding) `bcs/audit-compliance/CONTRACT.md`'s already-documented `record(event)` row. Only the schema + write-path requirements of `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md` are completed here — its retrofit-existing-mutations requirement stays open on that backlog item (plan.md's Complexity Tracking).

## `record(tx, event: NewAuditEvent): Promise<void>`

```ts
interface NewAuditEvent {
  organizationId: string | null;   // null only for a failed-login-against-unknown-email (data-model.md)
  actorUserId: string | null;
  actorApiKeyId: string | null;      // always null from this feature's own call sites
  action: string;                     // "resource.verb", e.g. "user.login"
  resourceType: string;
  resourceId: string | null;
  before?: unknown | null;
  after?: unknown | null;
}
```

Strips any `password_hash`, `key_hash`, or raw-token-shaped field found anywhere inside `before`/`after` (deep, not just top-level) before inserting — never stores secret material even inside an audit diff (tenet S3 extended to the audit trail, per `backlog/003-audit-compliance/001`'s own requirement). Inserts exactly one row into `audit.audit_events`. Takes `tx` (a transaction handle), not `db` — by construction, this is only callable from inside an open transaction (a `db.transaction()` block or a `withAudit()` call), never as a standalone unaudited write outside one, matching that backlog item's explicit requirement.

**Consumers**: `identity-access`'s `login`/`logout` (this feature, the first real caller). Every future bounded-context mutation that adopts `withAudit()` (tracked, not yet done, per plan.md's Complexity Tracking).

## Not exposed

`audit-events-repo.ts`'s raw `insert()` stays internal to `application/record.ts` — no other module, in or out of this BC, inserts into `audit.audit_events` directly.
