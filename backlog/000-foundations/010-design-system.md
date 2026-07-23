---
type: foundations
item: 010-design-system
status: open
deliverable: context/design-system.md
---

# Design System

`007-distribution/003-web-ui-shell-and-core-pages.md` deliberately carries the existing shadcn/Tailwind primitives forward unchanged — it's a functional-parity rebuild, not a visual one. Before `009-ui-redesign` can start applying a real visual/UX pass across every page, the project needs a written, permanent answer for what that visual system actually is: palette, type scale, spacing/tokens, and which shadcn component variants are in vs. customized. Without this doc, each `009-ui-redesign` feature would be re-deciding brand basics page by page, producing an inconsistent result.

## What We Need to Decide / Research

- Color palette (light + dark mode) — brand colors, semantic colors (success/warning/danger/info), neutral scale
- Typography — font family, type scale, weight usage
- Spacing/sizing scale and any layout grid conventions
- Which shadcn components get restyled vs. used as-is; any new component variants needed (e.g. a denser table variant for prompt/policy list views)
- Iconography — icon set in use, sizing conventions
- Motion/transition conventions (if any) for state changes, loading, page transitions
- How design tokens are expressed in code (Tailwind config theme extension vs. CSS variables) so `009-ui-redesign/001-design-tokens-and-theming.md` has a concrete implementation target

## Options / Considerations

- Reuse mockups already produced in Claude design as the source of truth for palette/typography rather than deriving from scratch — extract tokens from those mockups instead of relitigating brand direction here
- Keep shadcn's underlying primitive/accessibility behavior untouched; this is a theming pass, not a component-library swap
- Dark mode: confirm whether it's in scope for this pass or a later one — affects whether tokens need light/dark pairs now

## Deliverable

When complete, write findings to `context/design-system.md`. That document becomes the permanent reference — every `009-ui-redesign` feature file links back to it for the specific token values/rules it must apply.

## Dependencies

None.
