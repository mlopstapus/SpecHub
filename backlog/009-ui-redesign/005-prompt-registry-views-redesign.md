---
epic: 009-ui-redesign
feature: 005-prompt-registry-views-redesign
status: open
dependencies: ["001-design-tokens-and-theming.md"]
---

# Prompt Registry Views Redesign

Apply the Claude design mockups to the prompt list, detail, creation, and new-version pages — the core value-delivering surface of the product.

## Requirements

- [ ] `prompts` (list) redesigned per mockups
- [ ] `prompts/new` redesigned per mockups
- [ ] `prompts/[name]` (detail, including version history and expansion/preview) redesigned per mockups
- [ ] `prompts/[name]/new-version` redesigned per mockups

## Acceptance Criteria

- [ ] Each page visually matches its corresponding Claude design mockup
- [ ] No behavioral regression against `005-prompt-registry` as composed in `007-distribution/003-web-ui-shell-and-core-pages.md` — create/view/edit a prompt and expand it via the UI still works exactly as before
- [ ] Prompt template/variable rendering (including any syntax highlighting) remains legible in the new visual treatment
- [ ] Responsive at mobile/tablet/desktop breakpoints

## Open Questions

- None currently.

## Dependencies

- `001-design-tokens-and-theming.md`

## Technical Notes

Pure restyle. Template rendering itself stays behind the sandboxed renderer per tenet S2 — this feature only touches presentation of the same rendered output, not how it's produced.
