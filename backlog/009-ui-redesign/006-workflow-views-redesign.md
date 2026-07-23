---
epic: 009-ui-redesign
feature: 006-workflow-views-redesign
status: open
dependencies: ["001-design-tokens-and-theming.md"]
---

# Workflow Views Redesign

Apply the Claude design mockups to the workflow list, creation, and detail/run pages.

## Requirements

- [ ] `workflows` (list) redesigned per mockups
- [ ] `workflows/new` redesigned per mockups
- [ ] `workflows/[id]` (detail, including run history/status) redesigned per mockups

## Acceptance Criteria

- [ ] Each page visually matches its corresponding Claude design mockup
- [ ] No behavioral regression against `006-workflow-orchestration` as composed in `007-distribution/003-web-ui-shell-and-core-pages.md` — create/view/run a workflow still works exactly as before
- [ ] Workflow step sequencing and run status remain clearly legible in the new visual treatment
- [ ] Responsive at mobile/tablet/desktop breakpoints

## Open Questions

- None currently.

## Dependencies

- `001-design-tokens-and-theming.md`

## Technical Notes

Pure restyle — workflow execution/runner logic (`006-workflow-orchestration/002-workflow-runner.md`) is out of scope here.
