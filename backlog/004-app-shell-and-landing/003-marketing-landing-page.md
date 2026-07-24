---
epic: 004-app-shell-and-landing
feature: 003-marketing-landing-page
status: open
dependencies: ["archive/001-design-tokens-and-theming.md"]
---

# Marketing Landing Page

The public, unauthenticated marketing homepage — distinct from the authenticated app shell in `002-app-shell-and-navigation.md`. Build from `SkillCanon Landing.dc.html` (claude.ai/design project `7babdbf3-c063-46b5-84df-ffa9f588d88a`), pulled via the `claude_design` MCP server the same way `003-audit-compliance/003-audit-log-ui.md` pulled its own mockup.

## Requirements

- [ ] Public nav: How it works / Governance / Features / Integrations / Quickstart anchor links, a Docs link (to the GitHub repo's `docs/` per the mockup), a GitHub link, and a light/dark theme toggle
- [ ] Hero and remaining marketing sections per the mockup — pull the full file content before implementing rather than working from a partial read; this feature file was written from only the nav/hero portion of the mockup
- [ ] Light/dark theme both implemented (this page's mockup has a working toggle, unlike the dark-only authenticated-app mockups — see `archive/001-design-tokens-and-theming.md`'s resolved Open Question, and the `[data-theme="light"]` override already added in `src/app/globals.css`)

## Acceptance Criteria

- [ ] Page visually matches `SkillCanon Landing.dc.html`, in both light and dark mode
- [ ] Every anchor nav link scrolls to its corresponding section

## Open Questions

- **Scope/ownership, unresolved**: is a public marketing site actually in scope for this repo/product, or does it belong to a separate deliverable (e.g. a docs/marketing site outside the SkillCanon app itself)? Nothing in `context/architecture.md` or the rest of this backlog currently describes a public marketing surface — confirm routing (e.g. root `/` when unauthenticated vs. a dedicated marketing subdomain/repo) before implementing, rather than assuming it's just another route in this Next.js app.

## Dependencies

- `archive/001-design-tokens-and-theming.md`

## Technical Notes

Unlike `002-app-shell-and-navigation.md`, this page shares no session/auth-gating concerns — it's the page an unauthenticated visitor sees. Keep its token usage aligned with `archive/001-design-tokens-and-theming.md` even though its palette has a light-mode variant the authenticated app currently doesn't.
