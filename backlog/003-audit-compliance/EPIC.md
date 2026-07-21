# Epic 003: Audit & Compliance

**Priority:** 3
**Status:** not-started
**Goal:** Build the immutable audit log and the transactional write path every subsequent bounded context will call into, so audit coverage is complete from the first mutation onward rather than retrofitted later.

## Overview

Built deliberately early — right after Identity & Access, before Governance, Prompt Registry, or Workflow Orchestration exist — because every mutation those contexts add needs `withAudit()` (built in epic 001) to have somewhere real to write to. This directly satisfies tenet C1 (every mutation captured, on every transport) and closes the gap the tenets doc calls out explicitly: the current `mcp/tools.py`'s `sh_run` never calls `record_usage` while the REST path does. In the new architecture, that gap is structurally prevented — `withAudit()` is the only sanctioned way to mutate, not an opt-in.

## Features

- [ ] [001 - Audit Event Schema & Write Path](001-audit-event-schema-and-write-path.md)
- [ ] [002 - Audit Query & Retention](002-audit-query-and-retention.md)
- [ ] [003 - Audit Log UI](003-audit-log-ui.md)

*Completed features are moved to `archive/` and checked off here.*

## Dependencies

- `backlog/002-identity-access/EPIC.md` (needs org/user identifiers to attribute events to)
- `backlog/001-typescript-refactor-foundation/002-drizzle-shared-db-kernel.md` (the `withAudit()` wrapper shell was built there; this epic implements what it writes to)

## Notes

Feature 002's retention logic depends on `resolveEntitlements()`, which doesn't exist until epic 008 — build it against a hardcoded Free-tier default (per `bcs/billing-entitlements/OWNERSHIP.md`'s self-host note) and wire in the real entitlement call once epic 008 lands, rather than blocking this epic on billing.
