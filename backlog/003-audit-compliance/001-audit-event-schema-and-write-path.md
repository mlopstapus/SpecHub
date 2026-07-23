---
epic: 003-audit-compliance
feature: 001-audit-event-schema-and-write-path
status: open
dependencies: ["backlog/002-identity-access/EPIC.md", "backlog/001-typescript-refactor-foundation/002-drizzle-shared-db-kernel.md"]
---

# Audit Event Schema & Write Path

Implement the `audit.audit_events` table and the `record()` contract function that `withAudit()` (built in epic 001) calls into, per `bcs/audit-compliance/CONTRACT.md`.

## Requirements

- [ ] `audit.audit_events` table: `id`, `organization_id`, `actor_user_id` (nullable), `actor_api_key_id` (nullable), `action` (string, `resource.verb` convention), `resource_type`, `resource_id`, `before` (jsonb, nullable), `after` (jsonb, nullable), `created_at` — append-only, no update/delete paths in application code
- [ ] `record(event)` function: inserts one row, callable only from within `withAudit()`'s transaction (not exposed as a standalone unaudited write path)
- [ ] Redaction: `before`/`after` payloads strip known-sensitive fields (`password_hash`, `key_hash`, raw JWT/API key values) before storage — never store secret material even inside an audit diff
- [ ] Index on `(organization_id, created_at)` for query and retention-pruning performance
- [ ] Retrofit epic 002's (identity-access) mutations built before this table existed — organization creation (`backlog/002-identity-access/001-organization-tenant-model.md`), team creation, user creation, invitations, API key issuance — to call `withAudit()` now that a real write path exists; they predate this feature and may not be wrapped yet

## Acceptance Criteria

- [ ] A mutation performed through `withAudit()` produces exactly one corresponding `audit_events` row in the same transaction
- [ ] Forcing the mutation to fail also prevents the audit row from being written (already covered by epic 001's `withAudit()` test, re-verified here against the real table)
- [ ] A redaction test confirms `password_hash`/`key_hash`/raw secrets never appear in a stored `before`/`after` payload, even when the mutated entity contains them

## Open Questions

- None — this is the concrete schema for the contract already defined in `bcs/audit-compliance/CONTRACT.md`.

## Dependencies

- `backlog/002-identity-access/EPIC.md`
- `backlog/001-typescript-refactor-foundation/002-drizzle-shared-db-kernel.md`

## Technical Notes

Directly implements tenet C1. The redaction requirement is a direct extension of tenet S3 ("secrets never appear in logs, even truncated") applied to the audit trail itself — an audit log that leaks secret material would be a worse regression than not having one.
