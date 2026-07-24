---
epic: 002-identity-access
feature: 010-account-and-team-settings-ui
status: open
dependencies: ["archive/002-team-hierarchy.md", "archive/006-api-keys.md", "backlog/004-app-shell-and-landing/002-app-shell-and-navigation.md"]
---

# Account & Team Settings UI

The real, finished org/team management and API-key settings pages, plus the top-level `teams` hierarchy view — owned by this BC per `bcs/identity-access/OWNERSHIP.md` (`src/app/(auth).../settings/*`). Composed into the shared shell from `004-app-shell-and-landing/002-app-shell-and-navigation.md`, built with real design directly rather than deferred to a later redesign pass, same pattern as `003-audit-compliance/003-audit-log-ui.md`.

**Status (2026-07-23): no Claude design mockup exists yet for these pages.** Pull one via the `claude_design` MCP server and run the same gap-analysis pass against `archive/002-team-hierarchy.md`/`archive/006-api-keys.md` before finalizing the Requirements below in detail.

## Requirements

- [ ] Pull the settings/teams mockup(s) from claude.ai/design before finalizing the rest of this list
- [ ] `settings/api-keys`, org/team management settings, and the top-level `teams` hierarchy list/detail view — page inventory carried over from the now-dissolved `010-ui-polish-and-accessibility` epic's original redesign scope; confirm against the actual mockup once it exists

## Acceptance Criteria

- [ ] Every core workflow (create/manage a team, issue/revoke an API key) works end-to-end through this UI
- [ ] Team hierarchy (parent/child structure) remains fully legible
- [ ] The page(s) visually match whatever mockup is pulled in

## Open Questions

- Which mockup file(s) cover these pages — none were found alongside the three existing mockups (Audit, Governance, Landing) as of 2026-07-23.

## Dependencies

- `archive/002-team-hierarchy.md`
- `archive/006-api-keys.md`
- `backlog/004-app-shell-and-landing/EPIC.md`

## Technical Notes

Pure UI over already-shipped, stable backend logic — team hierarchy depth/ordering logic itself is out of scope here.
