---
epic: 008-billing-entitlements
feature: 004-entitlement-enforcement-integration
status: open
dependencies: ["001-plan-and-entitlement-model.md", "backlog/003-audit-compliance/002-audit-query-and-retention.md"]
---

# Entitlement Enforcement Integration

Go back through every bounded context and wire real `resolveEntitlements()` calls into the limit/feature checks that earlier epics either left as hardcoded Free-tier stand-ins or didn't gate at all, since `resolveEntitlements()` didn't exist yet when those epics were built.

## Requirements

- [ ] `003-audit-compliance/002-audit-query-and-retention.md`'s hardcoded Free-tier retention/export gating replaced with a real `resolveEntitlements(orgId).auditRetentionDays` / export-flag call
- [ ] `002-identity-access`'s team/API-key creation checked against `maxTeams`/`maxApiKeys` entitlements where those limits exist per `context/entitlements.md`
- [ ] `002-identity-access/003-user-accounts-and-registration.md`'s `registerFirstRunAdmin` hardcoded-`true` `coreFeaturesEnabled` stand-in (`src/bcs/identity-access/application/entitlement-gate.ts`) replaced with a real `requireEntitlement(orgId, "coreFeaturesEnabled")` call
- [ ] Audit sweep of all prior epics for any other hardcoded-default stand-ins introduced along the way, replaced with real entitlement calls
- [ ] Self-hosted mode continues to use the hardcoded Free-tier path unchanged (this feature only affects the SaaS/live-entitlement path)

## Acceptance Criteria

- [ ] Audit retention/export behavior for a SaaS org now reflects its actual entitlement (including any per-org override), not a hardcoded default
- [ ] Creating a team/API key beyond a SaaS org's entitled limit is rejected with a clear "upgrade" error, per whatever limits `context/entitlements.md` actually sets
- [ ] Self-hosted installs are unaffected — verified by re-running the self-host acceptance tests from `001-plan-and-entitlement-model.md` and confirming no behavior change

## Open Questions

- None — this is integration work closing gaps intentionally left open by earlier epics, not new design.

## Dependencies

- `001-plan-and-entitlement-model.md`
- `backlog/003-audit-compliance/002-audit-query-and-retention.md`

## Technical Notes

This feature exists because building Billing & Entitlements last (deliberately, per this epic's own overview) means earlier epics had to stand something in for entitlement checks before the real system existed — this is where that debt gets paid off, not a sign the earlier epics were done wrong.
