---
epic: 004-app-shell-and-landing
feature: 002-app-shell-and-navigation
status: open
dependencies: ["001-design-tokens-and-theming.md", "backlog/002-identity-access/archive/004-jwt-session-auth.md"]
---

# App Shell & Navigation

The real, finished authenticated app shell — left nav, layout, and auth-gated routing — that every downstream epic's own UI feature (Governance, Prompt Registry, Workflow Orchestration, Distribution's remaining core pages, Billing) composes its pages into. Build directly from the shell markup shared by `SkillCanon Audit.dc.html` and `SkillCanon Governance.dc.html` (claude.ai/design project `7babdbf3-c063-46b5-84df-ffa9f588d88a`, via the `claude_design` MCP server / `DesignSync get_file`) rather than reinventing it — the same file, markup, and porting approach `003-audit-compliance/003-audit-log-ui.md`'s Technical Notes already established for one page.

## Requirements

- [ ] Left nav, "Workspace" section: Overview, a prompts/skills section, Governance, Teams, Workflows, Metrics (see Open Questions — the two source mockups disagree on exact naming/composition here)
- [ ] Left nav, "Settings" section: API keys, Audit log (both mockups agree on these two)
- [ ] Account footer: avatar-initial badge, name, role · team subtext, chevron
- [ ] Real session-auth middleware (httpOnly JWT cookie from `002-identity-access/archive/004-jwt-session-auth.md`) gating every `(app)/**` route — the first real implementation of this in the codebase; every downstream UI feature (starting with `003-audit-compliance/003-audit-log-ui.md`) depends on it directly
- [ ] This feature builds only the shell/chrome (nav, layout, routing gate) — page content for each section is each owning BC's own UI feature, composed in

## Acceptance Criteria

- [ ] Unauthenticated access to any `(app)` route redirects to login
- [ ] `003-audit-compliance/003-audit-log-ui.md` (the first consumer) composes into this shell correctly, using its real nav/tokens rather than any standalone version
- [ ] Nav highlights the active section correctly across every composed page

## Open Questions

- **Real inconsistency between the two source mockups, needs resolving before implementation**: `SkillCanon Audit.dc.html`'s nav has `Overview / Skills / Governance / Teams / Workflows / Metrics` (no separate "Projects" item). `SkillCanon Governance.dc.html`'s nav has `Overview / Prompts / Governance / Teams / Workflows / Projects / Metrics` — a differently-named prompt-registry item ("Prompts" vs "Skills") plus an extra "Projects" item Audit's nav doesn't have. Reconcile against `006-prompt-registry/OWNERSHIP.md` (which owns both `prompts/*` and `projects/*` routes) — likely both belong as separate nav items and Audit's mockup is just the earlier/incomplete one, but confirm rather than guessing.

## Dependencies

- `001-design-tokens-and-theming.md`
- `backlog/002-identity-access/archive/004-jwt-session-auth.md` (httpOnly JWT cookie this feature's middleware verifies)

## Technical Notes

Per this feature's own Overview, treat the mockup files as literal blueprints (markup + inline styles + component logic), not just visual reference — pull the actual file content via `DesignSync get_file` and port it, rather than re-deriving the shell from a description.
