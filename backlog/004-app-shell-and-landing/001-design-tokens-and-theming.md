---
epic: 004-app-shell-and-landing
feature: 001-design-tokens-and-theming
status: open
dependencies: ["backlog/000-foundations/010-design-system.md"]
---

# Design Tokens & Theming

Implement the app's real palette, type scale, spacing, and component-variant decisions into the Tailwind/shadcn theme layer. Every downstream epic's own UI feature applies these tokens rather than inventing its own — this is the one place color, type, and spacing values are actually defined.

**Moved here (2026-07-23)** from `010-ui-polish-and-accessibility` (formerly `009-ui-redesign`), where it originally assumed a from-scratch research pass against `context/design-system.md`. That assumption no longer holds: `context/design-system.md` (`backlog/000-foundations/010-design-system.md`) is still nominally open, but its actual answer already exists in practice — three independent Claude design mockups (`SkillCanon Audit.dc.html`, `SkillCanon Governance.dc.html`, `SkillCanon Landing.dc.html`, all in claude.ai/design project `7babdbf3-c063-46b5-84df-ffa9f588d88a`) already share (or nearly share) one concrete dark-theme token set, and `003-audit-compliance/003-audit-log-ui.md` already shipped a local, hardcoded copy of it before this epic existed.

## Requirements

- [ ] Extract the exact token values already proven across the Audit/Governance mockups into `context/design-system.md` and the Tailwind theme config: `--bg`/`--panel`/`--surface`/`--surface2`/`--raise`, `--border`/`--border2`, `--text`/`--dim`/`--faint`, accent `--a`/`--a2`/`--afg`/`--asoft`/`--aglow` (teal), semantic `--green`/`--blue`/`--red`/`--violet` + their `*soft` variants, and the three font families (Bricolage Grotesque for display, Hanken Grotesk for body, Spline Sans Mono for mono/data) — treat these as an already-made decision to formalize, not something to re-derive from scratch
- [ ] Resolve the light/dark-mode question explicitly: `SkillCanon Landing.dc.html` implements a working light/dark theme toggle with a distinct light palette, while `SkillCanon Audit.dc.html`/`SkillCanon Governance.dc.html` (the authenticated app) only ever show a dark theme with no toggle — decide whether the authenticated app is intentionally dark-only (matching what's actually been designed so far) or needs a light mode added, before finalizing the token system either way
- [ ] shadcn component variants customized per the above (denser table variant for list views, badge/pill variants matching the mockups' action/transport/mode color-coding) without modifying shadcn's underlying accessibility/behavior primitives
- [ ] Reconcile `003-audit-compliance/003-audit-log-ui.md`'s locally-scoped token copy against this shared system and repoint it here, deleting the local copy (per that feature's own forward-pull note)
- [ ] A single shared theme/style reference so every downstream epic's UI feature has one place to check token usage instead of re-deriving it per page

## Acceptance Criteria

- [ ] Changing a token value (e.g. the accent color) propagates without a per-page code change
- [ ] `003-audit-compliance/003-audit-log-ui.md` (already shipped) is repointed at the shared tokens with no visual regression
- [ ] No page-level feature in any downstream epic needs to hardcode a color, font size, or spacing value outside the token system
- [ ] Existing shadcn component behavior (keyboard nav, focus states, ARIA attributes) is unchanged — only visual styling changed

## Open Questions

- Light mode for the authenticated app: in scope for this feature, or a deliberately deferred later pass? (See Requirements above — this is the one real open decision, everything else is extraction of already-made choices.)

## Dependencies

- `backlog/000-foundations/010-design-system.md`

## Technical Notes

Land this before `002-app-shell-and-navigation.md` and every downstream epic's own UI feature — all of them depend on it. Per CLAUDE.md, the app already pins `shadcn`/Tailwind conventions — this feature rethemes that system, it doesn't replace the component library.
