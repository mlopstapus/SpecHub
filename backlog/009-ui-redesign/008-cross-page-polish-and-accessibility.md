---
epic: 009-ui-redesign
feature: 008-cross-page-polish-and-accessibility
status: open
dependencies: ["002-auth-and-onboarding-redesign.md", "003-workspace-redesign.md", "004-governance-views-redesign.md", "005-prompt-registry-views-redesign.md", "006-workflow-views-redesign.md", "007-settings-and-admin-views-redesign.md"]
---

# Cross-Page Polish & Accessibility

A final pass across every page redesigned in this epic, closing consistency and accessibility gaps that only show up once every page exists in its new visual form.

## Requirements

- [ ] Empty, loading, and error states are visually consistent across all redesigned pages (one pattern per state type, not a different one per page)
- [ ] Dark mode (if in scope per `context/design-system.md`) verified across every redesigned page, not just the pages built first
- [ ] Keyboard navigation and focus states verified across every redesigned page
- [ ] Accessibility audit (automated — e.g. axe — plus manual screen-reader spot-check) across every redesigned page; issues fixed, not just logged
- [ ] Responsive layout verified end-to-end across the full page set at mobile/tablet/desktop breakpoints

## Acceptance Criteria

- [ ] Automated accessibility scan reports no critical/serious violations on any redesigned page
- [ ] A single documented pattern each for empty/loading/error states, referenced from `context/design-system.md`
- [ ] Manual smoke test across the full redesigned app: register → accept invite → create a team → create a project → create a policy → create a prompt → expand it → create a workflow → run it — every step visually consistent with no regressions from the individual page features

## Open Questions

- None currently.

## Dependencies

- `002-auth-and-onboarding-redesign.md`
- `003-workspace-redesign.md`
- `004-governance-views-redesign.md`
- `005-prompt-registry-views-redesign.md`
- `006-workflow-views-redesign.md`
- `007-settings-and-admin-views-redesign.md`

## Technical Notes

This is the last feature in the last epic before go-live — treat its acceptance criteria as the epic's overall Definition of Done, not just this one feature's.
