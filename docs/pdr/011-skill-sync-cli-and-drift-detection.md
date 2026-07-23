# PDR-011: Project Linking and Roster Sync via CLI, SessionStart Hook, and Hash-Based Drift Detection

**Status:** Accepted
**Date:** 2026-07-23

## Context

For the skill-based distribution model in [PDR-010](010-skill-based-distribution-not-mcp.md) to require zero ongoing thought from the user, a repo needs to (a) be linked to a specific SkillCanon project once, and (b) keep its local roster of skill stub files in sync with that project's prompt list automatically, without clobbering any local hand-edit to a stub. This repo already has a working precedent for this exact shape of problem: Spec Kit's own `.specify/integrations/*.manifest.json` tracks a content hash per file, per tool-target (claude/codex/speckit), written by its own CLI on each re-run.

## Options Considered

### Config file only, no CLI, no drift detection (rejected)
User hand-writes a project-key config file; every sync unconditionally overwrites stub files.
Pros: minimal to build.
Cons: no protection against overwriting a user's local hand-edit to a stub; hand-authoring a config file reintroduces exactly the "user has to think about it" friction the design is meant to remove.

### Dedicated CLI (`skillcanon init`/`sync`/`run`) + SessionStart hook + content-hash drift detection (chosen)
`skillcanon init` handshakes the repo to a project (project key committed, API key credential gitignored), installs a Claude Code `SessionStart` hook, and runs the first sync. Every subsequent session start silently re-syncs. Each stub's last-written content hash is tracked so a local edit is detected and flagged rather than silently overwritten.
Pros: genuinely zero-touch after a one-time init; mirrors an already-proven pattern in this repo (`.specify/integrations/*.manifest.json`); protects any local customization of a stub file.
Cons: introduces a new CLI package to build and maintain; the hook mechanism is Claude-Code-specific and needs a separate adapter per additional IDE later.

### Background daemon / file watcher (rejected)
A long-running local process watches for SkillCanon-side changes and updates stubs continuously.
Pros: could react faster than "next session start."
Cons: real operational burden (a process to keep alive, monitor, restart) for a benefit — near-real-time roster updates — nobody asked for. Prompt-roster changes are infrequent, org-level events, not something needing sub-second propagation. Rejected as premature infrastructure for the actual access pattern.

## Decision

Adopt the CLI + SessionStart hook + hash-based drift detection design, per `backlog/007-distribution/005-skill-sync-cli.md`. The project key (non-secret) lives in a committed `.skillcanon/project.json`; the API key credential is stored gitignored, consistent with this repo's existing env-var-over-hardcoded-secret convention for other credentials (`docker-compose.yaml`'s Postgres credentials).

## Consequences

- **Positive:** Zero ongoing user action after one-time init; local customization of a stub file is protected by design; consistent with an already-validated pattern in this repo rather than a new one-off mechanism.
- **Negative:** Claude-Code-only at launch. The hook's installation location (global Claude Code settings vs. project-local `.claude/settings.json`) is still an open question in `005-skill-sync-cli.md` — it decides whether skill-sync is a per-repo or per-machine opt-in.
- **Risks:** A soft-failing sync (expired credential, offline) leaves the user working off a stale roster with no active alert beyond the sync command's own output. Acceptable given how infrequently the roster actually changes, but worth revisiting if it causes confusion in practice.
