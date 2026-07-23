# Epic 003: Audit & Compliance

**Priority:** 3
**Status:** in-progress (item 001's schema/write-path pulled forward ahead of this epic's normal sequencing — see Notes)
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

**Sequencing exception (2026-07-23)**: `002-identity-access/008-jwt-session-auth` (still within epic 002, not after it) needed a real audit write path *now* — for login/logout audit events — rather than waiting for this epic to start per its normal "right after Identity & Access [fully finishes]" sequencing. Rather than block that feature or build a throwaway parallel audit mechanism, it pulled item 001's schema/`record()`/redaction/index requirements forward and completed them directly (see that feature's plan.md Complexity Tracking and `001-audit-event-schema-and-write-path.md`, still `status: open`). Item 001's retrofit requirement (wrapping already-shipped epic-002 mutations in `withAudit()`) is untouched and remains this epic's own work whenever it formally starts. New gap surfaced by this: `audit.audit_events` has no RLS policy yet and no existing backlog item owns adding one for the `audit` schema.

**Second, larger sequencing exception (2026-07-23)**: an explicit decision to have the real, visually-finished audit trail UI in place by the end of *this* epic — not a functional-placeholder-now/restyle-later approach — means `003-audit-log-ui.md` now also pulls forward two chunks of later epics' scope: a minimal app shell/nav (normally `007-distribution/003-web-ui-shell-and-core-pages.md`'s job) and the page's actual visual design (normally `009-ui-redesign/001-design-tokens-and-theming.md` + `009-ui-redesign/007-settings-and-admin-views-redesign.md`'s job), both built directly from the Claude design mockup `SkillCanon Audit.dc.html` (project `7babdbf3-c063-46b5-84df-ffa9f588d88a`, accessible via the `claude_design` MCP server) rather than waiting for those epics to start. This also newly requires wiring session auth into a Next.js route/middleware for the first time in this codebase — previously entirely epic 007's job. See `003-audit-log-ui.md`'s Technical Notes for the full breakdown and the reciprocal notes left on `007-distribution/003-web-ui-shell-and-core-pages.md`, `009-ui-redesign/001-design-tokens-and-theming.md`, and `009-ui-redesign/007-settings-and-admin-views-redesign.md`. This is a one-off scope call for this page, not a new standing pattern of epics 003/007/009 routinely overlapping.
