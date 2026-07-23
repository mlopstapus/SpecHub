---
epic: 007-distribution
feature: 005-skill-sync-cli
status: open
dependencies: ["001-rest-api-core-routes.md"]
---

# Skill Sync CLI

A `spechub` CLI, distributed separately from this app (new package), that makes a connected repo's governed prompts show up as native Claude Code skills instead of requiring the IDE to be configured as an MCP client. Reliability of *invocation* was the driver: an agent reliably triggers a well-described Skill by name/description match; it does not reliably decide to call an arbitrary MCP tool. The CLI's job is to keep a roster of thin skill-stub files in sync with the SpecHub project's prompt list, and to resolve each one live (never cached) at the moment it's actually invoked, preserving the same read-fresh, fail-closed governance guarantee `architecture.md` already commits to for the MCP path.

No new server surface is needed — both operations the CLI performs are routes `001-rest-api-core-routes.md` already plans to port: listing prompts (for the roster) and `POST /prompts/expand/{name}` (for live resolution).

## Requirements

- [ ] `spechub init --project-key <key>`: prompts for/accepts an API key; writes `.spechub/project.json` (project key — safe to commit) and a **gitignored** local credential file (API key — never committed, consistent with this repo's own env-var-over-hardcoded-secret convention for other credentials); installs a Claude Code `SessionStart` hook; runs the first sync; appends a one-paragraph SpecHub blurb to `CLAUDE.md` and `AGENTS.md` (creating either file if it doesn't already exist)
- [ ] `spechub sync`: fetches the current prompt roster for the linked project via the existing prompts-list route; diffs it against `.claude/skills/spechub-*/`; writes/removes/updates stub `SKILL.md` files (frontmatter `name`/`description` sourced from the prompt's own metadata so Claude's normal skill-matching selects the right one; body is a one-line instruction to run `spechub run <slug>` and follow the output as instructions)
- [ ] Per-stub content-hash tracking (mirroring `.specify/integrations/*.manifest.json`'s drift-detection pattern) so a user's local hand-edit to a stub is detected and flagged, never silently overwritten by the next sync
- [ ] `spechub run <slug> [args]`: calls `POST /prompts/expand/{slug}`, prints the resolved, governed prompt text to stdout
- [ ] The `SessionStart` hook shells out to `spechub sync` quietly at the start of every Claude Code session

## Acceptance Criteria

- [ ] After `spechub init`, a session start with no further user action produces a working `.claude/skills/spechub-<slug>/` stub for every prompt visible to that API key's project
- [ ] Adding/renaming/removing a prompt in SpecHub is reflected in the local roster after the next session start, with no manual sync step
- [ ] `spechub run` on a governed prompt returns output reflecting the *current* state of any policy/objective attached to it — a policy change takes effect on the very next invocation, not after a delay
- [ ] `spechub run` fails loudly (non-zero exit, clear error message) on network failure, an expired/invalid credential, or a since-deleted prompt — no stale fallback, no silent success
- [ ] A locally hand-edited stub file is never overwritten by `sync` without an explicit flag/warning
- [ ] The API key/credential file never appears in `git status` as trackable (gitignored) and is never printed in any CLI log output

## Open Questions

- Exact CLI package name/publish target (npm scope, binary name) — not yet decided, doesn't block designing the feature.
- Whether the `SessionStart` hook installs itself into the user's global Claude Code settings or a project-local `.claude/settings.json` — affects whether skill-sync is per-repo or per-machine opt-in.

## Dependencies

- `001-rest-api-core-routes.md` (provides the prompts-list and `/prompts/expand/{name}` routes this CLI calls)

## Technical Notes

This feature is scoped to Claude Code only for v1 — the sync/hook mechanism should be designed pluggable per IDE (mirroring `.specify/integrations/*.manifest.json`'s per-tool split across Claude/Codex/speckit already present in this repo), but only the Claude Code adapter needs to be built now. Extending to Copilot/Codex/others is future work, not part of this feature's acceptance criteria.

This feature effectively supersedes `002-mcp-server-and-tools.md` in priority — see that file's Technical Notes for the reasoning and current status.
