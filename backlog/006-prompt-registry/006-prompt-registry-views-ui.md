---
epic: 006-prompt-registry
feature: 006-prompt-registry-views-ui
status: open
dependencies: ["004-expansion-engine.md", "005-prompt-registry-tenant-isolation-tests.md", "backlog/004-app-shell-and-landing/002-app-shell-and-navigation.md"]
---

# Prompt Registry Views UI

The real, finished prompts + projects UI — owned by this BC per `bcs/prompt-registry/OWNERSHIP.md` (`src/app/(app)/prompts/*`, `/projects/*`) — built the same way `003-audit-compliance/003-audit-log-ui.md` and `005-governance/005-governance-views-ui.md` were: composed into the shared shell from `004-app-shell-and-landing/002-app-shell-and-navigation.md`, with real, finished design applied directly rather than deferred to a later redesign pass.

**Status (2026-07-23): no Claude design mockup exists yet for these pages.** Unlike audit-log and governance, this feature's Requirements/Acceptance Criteria are not yet written in detail — per the established process, pull the corresponding mockup(s) via the `claude_design` MCP server first, do the same gap-analysis pass against `001-project-model-and-membership.md`/`002-prompt-and-version-model.md`/`003-prompt-sharing.md`/`004-expansion-engine.md` that audit-log-ui and governance-views-ui did, and only then flesh out this file's Requirements. Don't invent page requirements from scratch here without a mockup to check them against.

## Requirements

- [ ] Pull the prompts/projects mockup(s) from claude.ai/design before finalizing the rest of this list
- [ ] `prompts` (list), `prompts/new`, `prompts/[name]` (detail, version history, expansion/preview), `prompts/[name]/new-version`, `projects` (list), `projects/[id]` (detail) — page inventory carried over from the now-dissolved `010-ui-polish-and-accessibility` epic's original redesign scope; confirm against the actual mockup once it exists

## Acceptance Criteria

- [ ] Every core workflow (create/view/edit a prompt, expand it, manage project membership) works end-to-end through this UI
- [ ] The page(s) visually match whatever mockup is pulled in

## Open Questions

- Which mockup file(s) in the design project cover these pages — none were found alongside `SkillCanon Audit.dc.html`/`SkillCanon Governance.dc.html`/`SkillCanon Landing.dc.html` as of 2026-07-23. Check for a newer file before starting this feature.

## Dependencies

- `004-expansion-engine.md`
- `005-prompt-registry-tenant-isolation-tests.md`
- `backlog/004-app-shell-and-landing/EPIC.md`

## Technical Notes

Template/variable rendering (including any syntax highlighting) stays behind the sandboxed renderer per tenet S2 — this feature only touches presentation of the same rendered output, not how it's produced.
