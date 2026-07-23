---
epic: 009-ui-redesign
feature: 003-workspace-redesign
status: open
dependencies: ["001-design-tokens-and-theming.md"]
---

# Workspace Redesign

Apply the Claude design mockups to the app's core navigational surfaces: the dashboard/root view, teams, and projects (list and detail). These are the pages a user lands on most often after login.

## Requirements

- [ ] `/` (dashboard/root landing) redesigned per mockups
- [ ] `teams` redesigned per mockups
- [ ] `projects` (list) redesigned per mockups
- [ ] `projects/[id]` (detail) redesigned per mockups

Policies and objectives are out of scope here — they move to standalone pages, covered by `004-governance-views-redesign.md`.

## Acceptance Criteria

- [ ] Each page visually matches its corresponding Claude design mockup
- [ ] No behavioral regression against `002-identity-access` (teams) or `005-prompt-registry` composition as built in `007-distribution/003-web-ui-shell-and-core-pages.md`
- [ ] Team hierarchy visualization (parent/child structure) remains fully legible in the new visual treatment
- [ ] Responsive at mobile/tablet/desktop breakpoints

## Open Questions

- None currently.

## Dependencies

- `001-design-tokens-and-theming.md`

## Technical Notes

Pure restyle of existing navigation/data structures — team hierarchy depth/ordering logic itself (`002-identity-access/002-team-hierarchy.md`) is out of scope here.
