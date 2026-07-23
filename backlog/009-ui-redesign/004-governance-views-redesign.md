---
epic: 009-ui-redesign
feature: 004-governance-views-redesign
status: open
dependencies: ["001-design-tokens-and-theming.md"]
---

# Governance Views Redesign

Apply the Claude design mockups to standalone policy and objective pages. `007-distribution/003-web-ui-shell-and-core-pages.md` already lists policies and objectives among its core ported pages — unlike the legacy app (where they only ever appeared inline inside `teams`/`projects`/`welcome`), the rebuilt app gives each its own list/detail views. This feature applies the visual redesign to those standalone pages once 007 has built them.

## Requirements

- [ ] Policies (list/detail) redesigned per mockups
- [ ] Objectives (list/detail) redesigned per mockups
- [ ] Navigation entry points from `teams`/`projects` into these standalone views restyled consistently with `003-workspace-redesign.md`

## Acceptance Criteria

- [ ] Each page visually matches its corresponding Claude design mockup
- [ ] No behavioral regression against `004-governance` (policy/objective CRUD, hierarchical resolution) as composed in `007-distribution/003-web-ui-shell-and-core-pages.md`
- [ ] Resolved/inherited policy or objective values (per the hierarchical resolution engine) remain clearly distinguishable from directly-set values in the new visual treatment
- [ ] Responsive at mobile/tablet/desktop breakpoints

## Open Questions

- None currently.

## Dependencies

- `001-design-tokens-and-theming.md`

## Technical Notes

Pure restyle — hierarchical resolution logic itself (`004-governance/003-hierarchical-resolution-engine.md`) is out of scope here. Coordinate navigation/entry-point styling with `003-workspace-redesign.md` since both land around the same time and touch adjacent nav surfaces.
