---
epic: 003-audit-compliance
feature: 001-audit-event-schema-and-write-path
status: open
dependencies: ["backlog/002-identity-access/EPIC.md", "backlog/001-typescript-refactor-foundation/002-drizzle-shared-db-kernel.md"]
---

# Audit Event Schema & Write Path

Implement the `audit.audit_events` table and the `record()` contract function that `withAudit()` (built in epic 001) calls into, per `bcs/audit-compliance/CONTRACT.md`.

## Requirements

- [X] `audit.audit_events` table: `id`, `organization_id`, `actor_user_id` (nullable), `actor_api_key_id` (nullable), `action` (string, `resource.verb` convention), `resource_type`, `resource_id`, `before` (jsonb, nullable), `after` (jsonb, nullable), `created_at` — append-only, no update/delete paths in application code (delivered by `008-jwt-session-auth`, `organization_id`/`resource_id` nullable — see that feature's data-model.md for the one documented case)
- [X] `record(tx, event)` function: inserts one row, redacting known-sensitive fields first (delivered by `008-jwt-session-auth`; not exposed as a standalone unaudited write path — only callable with an open transaction handle)
- [X] Redaction: `before`/`after` payloads strip known-sensitive fields (`password_hash`, `key_hash`, raw JWT/API key values) before storage — never store secret material even inside an audit diff (delivered by `008-jwt-session-auth`, tested directly in `record.test.ts`)
- [X] Index on `(organization_id, created_at)` for query and retention-pruning performance (delivered by `008-jwt-session-auth`)
- [ ] Retrofit epic 002's (identity-access) mutations built before this table existed — organization creation (`backlog/002-identity-access/001-organization-tenant-model.md`), team creation/update/reparenting/insert-between (`backlog/002-identity-access/002-team-hierarchy.md` — reparenting specifically is this backlog item's own unmet `TeamReparented` acceptance criterion), user creation, invitations, API key issuance — to call `withAudit()` now that a real write path exists; they predate this feature and may not be wrapped yet. **Still open** — `008-jwt-session-auth` (its own `login`/`logout`, new code, not a retrofit) is the only caller of `record()` so far; none of the mutations listed here have been touched.
- [ ] **New (2026-07-23, driven by the Claude design mockup `SkillCanon Audit.dc.html` — see `003-audit-log-ui.md`):** add a `transport` column (`"web" | "api" | "cli" | "system"`, not null) and a nullable `source_ip` column to `audit.audit_events`, and thread both through `NewAuditEvent`/`record(tx, event)`'s signature. Today neither field exists anywhere — not on the table, not on the domain type, not passed by `login`/`logout`'s calls to `record()` — so the audit trail currently has no way to answer "which surface did this mutation come from," even though tenet C1 and `bcs/audit-compliance/CONTRACT.md`'s own UI description ("captured in-transaction on the web app, REST API, and skill-sync CLI") assume it can. Note this taxonomy is deliberately *not* the same as `context/api-conventions.md`'s structured-log `transport: "rest" | "mcp"` field — that's a 2-value field for request logs; this is a 4-value field for the audit trail's own "Source" column/filter, and includes `system` for scheduled-job-originated events (see the retention-pruning self-log requirement in `002-audit-query-and-retention.md`). Every existing and future `record()` call site needs updating to pass a real value once this lands.
- [ ] **New (2026-07-23, same driver):** document the canonical `action` verb vocabulary and its UI color-coding as part of this contract (in `CONTRACT.md` or a short table here) — `created`/`updated`/`deleted`/`revoked`/`reparented`/`shared`/`invited`/`login`/`logout`/`login_failed`/`synced`/`pruned` are all implied by the mockup but never enumerated anywhere today. Any future BC adding a new mutation type should extend this list rather than inventing an unlisted verb.

## Acceptance Criteria

- [ ] A mutation performed through `withAudit()` produces exactly one corresponding `audit_events` row in the same transaction — **not yet verified**: `008-jwt-session-auth`'s `login`/`logout` call `record()` inside a plain `db.transaction()`, not `withAudit()` (neither is a "mutation" in the row-changing sense `withAudit()` pairs with — see that feature's research.md §7), so this specific pairing remains unexercised against the real table until a retrofit (above) or a future feature's mutation actually uses `withAudit()`
- [ ] Forcing the mutation to fail also prevents the audit row from being written (already covered by epic 001's `withAudit()` test, re-verified here against the real table) — **not yet re-verified against the real table**, same reason as above
- [X] A redaction test confirms `password_hash`/`key_hash`/raw secrets never appear in a stored `before`/`after` payload, even when the mutated entity contains them (delivered by `008-jwt-session-auth`'s `record.test.ts`)

## Open Questions

- None — this is the concrete schema for the contract already defined in `bcs/audit-compliance/CONTRACT.md`.
- **New, from `008-jwt-session-auth`**: `audit.audit_events` currently has no RLS policy — no existing backlog item owns audit-schema RLS (`007-tenant-isolation-tests-and-rls.md` is scoped to `identity_access.*` only). A future feature should own this, mirroring that item's pattern.

## Dependencies

- `backlog/002-identity-access/EPIC.md`
- `backlog/001-typescript-refactor-foundation/002-drizzle-shared-db-kernel.md`

## Technical Notes

Directly implements tenet C1. The redaction requirement is a direct extension of tenet S3 ("secrets never appear in logs, even truncated") applied to the audit trail itself — an audit log that leaks secret material would be a worse regression than not having one.
