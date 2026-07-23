---
epic: 009-ui-redesign
feature: 007-settings-and-admin-views-redesign
status: open
dependencies: ["001-design-tokens-and-theming.md", "backlog/003-audit-compliance/003-audit-log-ui.md", "backlog/008-billing-entitlements/003-billing-portal-and-ui.md"]
---

# Settings & Admin Views Redesign

Apply the Claude design mockups to every settings surface: API keys, org/team management, the audit log, and billing. Today these live under a single `settings` page in the legacy app; per `007-distribution/003-web-ui-shell-and-core-pages.md` and the BC-owned pages added by epics 003 and 008, this is now several distinct settings views composed into one shell.

## Requirements

- [ ] `settings/api-keys` redesigned per mockups
- [ ] `settings` org/team management redesigned per mockups
- [ ] `settings/audit-log` redesigned per mockups (owned by `003-audit-compliance`, composed here)
- [ ] `settings/billing` redesigned per mockups (owned by `008-billing-entitlements`, composed here; must still no-op/hide correctly in self-hosted mode)
- [ ] Shared settings navigation/layout (tabs or sidebar) restyled consistently across all four

## Acceptance Criteria

- [ ] Each page visually matches its corresponding Claude design mockup
- [ ] Admin-only access gating on audit-log and billing settings is unchanged
- [ ] Self-hosted install still shows billing settings as hidden/not-applicable rather than a broken checkout flow (per `008-billing-entitlements/003-billing-portal-and-ui.md`'s acceptance criteria)
- [ ] Responsive at mobile/tablet/desktop breakpoints

## Open Questions

- None currently.

## Dependencies

- `001-design-tokens-and-theming.md`
- `backlog/003-audit-compliance/003-audit-log-ui.md`
- `backlog/008-billing-entitlements/003-billing-portal-and-ui.md`

## Technical Notes

Per tenet D1, each settings sub-page's content is still owned by its originating bounded context (identity-access for api-keys/org-team, audit-compliance for audit-log, billing-entitlements for billing) even though this feature restyles all of them together for consistency — coordinate with those BCs' `OWNERSHIP.md` files rather than moving ownership.

**Forward-pull note (2026-07-23)**: `settings/audit-log`'s visual redesign was already done, ahead of schedule, directly against the same Claude design mockup (`SkillCanon Audit.dc.html`) this feature would otherwise draw from — see `003-audit-compliance/003-audit-log-ui.md`. Don't redo that page's styling from scratch; instead verify it still matches the mockup (functional changes landed between epic 003 and this epic may have drifted it) and repoint it at this epic's shared token system per `001-design-tokens-and-theming.md`'s own forward-pull note, reconciling rather than re-designing.
