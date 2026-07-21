---
epic: 003-audit-compliance
feature: 003-audit-log-ui
status: open
dependencies: ["002-audit-query-and-retention.md"]
---

# Audit Log UI

The settings page where an org admin views (and, if entitled, exports) their audit trail — owned by this BC per `bcs/audit-compliance/OWNERSHIP.md` (`src/app/(app)/settings/audit-log`), though it's composed into the app shell that Distribution (epic 007) owns.

## Requirements

- [ ] `settings/audit-log` page: paginated, filterable (by resource type, actor, date range) view over `list()`
- [ ] Export button, visible/enabled only when the org's entitlement allows it (disabled with an upgrade prompt otherwise, once epic 008 exists — hidden entirely until then)
- [ ] Admin-only access (matches current role-gating pattern for sensitive settings pages)

## Acceptance Criteria

- [ ] Non-admin users cannot access the page (redirected or 403)
- [ ] Filtering by resource type and date range returns correctly scoped results
- [ ] Page renders correctly with zero events (empty state) and with a large event count (pagination works)

## Open Questions

- None currently.

## Dependencies

- `002-audit-query-and-retention.md`

## Technical Notes

This page can reasonably wait until after epic 007 (Distribution) establishes the app shell/layout it renders inside — sequence pragmatically rather than strictly by epic number if that's more efficient, since this is a thin UI feature with no independent domain logic of its own.
