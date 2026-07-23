---
epic: 009-ui-redesign
feature: 001-design-tokens-and-theming
status: open
dependencies: ["backlog/000-foundations/010-design-system.md"]
---

# Design Tokens & Theming

Implement `context/design-system.md`'s palette, type scale, spacing, and component-variant decisions into the app's Tailwind/shadcn theme layer. Every other feature in this epic applies these tokens to a specific set of pages rather than inventing their own — this is the one place color, type, and spacing values are actually defined.

## Requirements

- [ ] Tailwind theme config updated with the token values from `context/design-system.md` (colors, type scale, spacing/radius scale)
- [ ] Light/dark mode both implemented if `context/design-system.md` scopes dark mode into this pass
- [ ] shadcn component variants customized per the design doc (e.g. denser table variant, button/badge variants) without modifying shadcn's underlying accessibility/behavior primitives
- [ ] A single shared theme/style reference (e.g. a `/design-system` or Storybook-style internal page, or a README in the shared UI package) so later features in this epic have one place to check token usage instead of re-deriving it per page

## Acceptance Criteria

- [ ] Changing a token value (e.g. primary color) propagates without needing a per-page code change
- [ ] No page-level feature in this epic needs to hardcode a color, font size, or spacing value outside the token system
- [ ] Existing shadcn component behavior (keyboard nav, focus states, ARIA attributes) is unchanged — only visual styling changed

## Open Questions

- None currently — blocked entirely on `context/design-system.md` existing with concrete values.

## Dependencies

- `backlog/000-foundations/010-design-system.md`

## Technical Notes

Per CLAUDE.md, the app already pins `shadcn`/Tailwind conventions carried forward from `007-distribution/003-web-ui-shell-and-core-pages.md` — this feature retheme's that system, it doesn't replace the component library. Land this first; every other feature in this epic depends on it.

**Forward-pull note (2026-07-23)**: `003-audit-compliance/003-audit-log-ui.md` already applied one page's worth of real tokens ahead of this feature (dark palette, Bricolage Grotesque/Hanken Grotesk/Spline Sans Mono fonts, spacing) taken directly from the Claude design mockup `SkillCanon Audit.dc.html`, scoped/hardcoded locally to that page rather than through a shared system — because `context/design-system.md` doesn't exist yet and the audit-log UI couldn't wait. When this feature builds the real token system, extract those same values as the actual source (they're already validated, shipped, real design decisions) rather than re-deriving the palette from scratch, and repoint the audit-log page at the shared tokens, deleting its local copy.
