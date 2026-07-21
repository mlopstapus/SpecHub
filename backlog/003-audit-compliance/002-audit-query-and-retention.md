---
epic: 003-audit-compliance
feature: 002-audit-query-and-retention
status: open
dependencies: ["001-audit-event-schema-and-write-path.md"]
---

# Audit Query & Retention

Implement `list()` and `export()` per `bcs/audit-compliance/CONTRACT.md`, gated by the caller's entitlement-resolved retention window, plus the scheduled pruning job that enforces retention.

## Requirements

- [ ] `list(orgId, filters, { requestingUserId })`: paginated query over `audit_events`, filtered to the org's retention window
- [ ] `export(orgId, format)`: bulk export (CSV/JSON), gated by an entitlement flag (Enterprise-tier feature per the original tier strawman, subject to whatever `context/entitlements.md` finalizes)
- [ ] Retention pruning: scheduled job deletes `audit_events` rows older than the org's `auditRetentionDays` entitlement
- [ ] Until epic 008 (Billing & Entitlements) exists, both retention and export gating use a hardcoded Free-tier default rather than a live `resolveEntitlements()` call — swapped for the real call once epic 008 lands

## Acceptance Criteria

- [ ] `list()` never returns another organization's events (covered by this BC's own tenant-isolation test, following the epic-002 pattern)
- [ ] Pruning job removes events older than the configured retention window and leaves newer ones untouched
- [ ] `export()` is rejected for an org without the export entitlement (using the hardcoded default until epic 008)

## Open Questions

- Export format(s) — CSV only, or also JSON/SIEM-friendly format for larger Enterprise customers? Defer to whoever's evaluating actual Enterprise deals; not blocking for launch.

## Dependencies

- `001-audit-event-schema-and-write-path.md`
- `backlog/000-foundations/007-entitlement-catalog.md` (for the `auditRetentionDays` default value to hardcode initially)

## Technical Notes

The temporary hardcoded-entitlement approach here is intentional, not a shortcut to revisit reluctantly — it's explicitly how `bcs/billing-entitlements/OWNERSHIP.md` says self-hosted installs are supposed to work (Free defaults, no live billing dependency), so this feature is correct as-is for self-host even before epic 008 exists. The swap to a live `resolveEntitlements()` call is only needed for the SaaS path.
