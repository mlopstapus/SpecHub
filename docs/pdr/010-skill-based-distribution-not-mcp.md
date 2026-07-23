# PDR-010: Skill-Based Prompt Distribution via Live REST Resolution, Not MCP

**Status:** Accepted
**Date:** 2026-07-23

## Context

The architecture originally assumed MCP (`sh-list`, `sh-search`, `sh-context`, `sh-run`, `sh-workflow-list`, `sh-workflow-run`) would be the primary interactive surface for prompt expansion, matching the current Python system 1:1 (see `bcs/distribution/CONTRACT.md`, `backlog/007-distribution/002-mcp-server-and-tools.md`). In practice, the harder problem turned out not to be transport but invocation reliability: an agent deterministically triggers a well-described Skill (a first-class construct in Claude Code and similar tools) far more reliably than it decides, on its own initiative, to call an arbitrary MCP tool with the right arguments. MCP also requires every IDE to be separately configured as an MCP client — real per-IDE setup friction a plain authenticated REST call doesn't have. Whatever the transport, governance resolution stays committed to being read-fresh and fail-closed on every expansion (this document's Failure Model) — staleness is not acceptable regardless of which distribution channel is used.

## Options Considered

### Keep MCP as the primary/only distribution protocol (original plan)
Matches the current Python implementation 1:1; already fully speced.
Pros: single protocol; no new client-side deliverable; MCP is a recognized standard for tool-calling IDEs.
Cons: requires every IDE to be configured as an MCP client; doesn't address the actual reliability complaint (agents choosing to invoke the right tool), which is about invocation UX, not wire protocol; carries transport complexity (Streamable HTTP, session state — PDR-008) for functionality a plain REST call also provides.

### Skill-based interface, live REST resolution at invocation time (chosen)
Governed prompts sync down as thin Claude Code Skill stub files (name/description sourced from prompt metadata). Each stub, when invoked, calls the REST expand endpoint (`POST /prompts/expand/{name}`, already planned in `backlog/007-distribution/001-rest-api-core-routes.md`) live — nothing is cached or baked into the stub.
Pros: invocation reliability improves (skills match deterministically by name/description); zero IDE-side protocol configuration; no new server surface; preserves the read-fresh/fail-closed governance guarantee by construction (every invocation is a live call).
Cons: introduces a new client-side component (the `spechub` CLI and its roster-sync mechanism, see PDR-011) that doesn't exist in the current Python system; ties day-one distribution specifically to Claude Code's skill mechanism — other IDEs (Copilot, Codex, Windsurf) need their own adapter to get the same treatment.

### Fully static skill files, periodically re-synced (rejected)
Bake the fully-expanded prompt text into each stub at sync time; refresh on some periodic cadence.
Pros: simplest possible stub file; no runtime dependency on SpecHub being reachable at the moment a skill is invoked.
Cons: directly violates the already-committed read-fresh, fail-closed governance model — a policy change wouldn't take effect until the next sync, and an outage would be invisible (stale content still "succeeds") rather than failing closed. Rejected once weighed against that existing decision, not on its own merits.

## Decision

Adopt skill-based distribution via live REST resolution as the primary path for Claude Code, per `backlog/007-distribution/005-skill-sync-cli.md`. The previously-planned MCP server (`backlog/007-distribution/002-mcp-server-and-tools.md`) is deprioritized, not removed — it stays available to build later for a non-skill-capable MCP client, or for workflow orchestration's multi-step `sh-workflow-run`, which this decision does not attempt to replace.

## Consequences

- **Positive:** IDE-side MCP configuration is no longer a requirement for the primary self-hosted use case; no new server-side surface is required beyond what `001-rest-api-core-routes.md` already plans; the governance freshness guarantee is preserved by construction, since every invocation is a live call, not a cache read.
- **Negative:** Adds a new client-side deliverable (the `spechub` CLI, see PDR-011) that has to be built and maintained per supported IDE. Claude Code is the only supported IDE at launch — users of other IDEs still need MCP (deprioritized) or direct REST/API usage in the meantime.
- **Risks:** If the roster-sync mechanism silently fails, a repo's skill list can drift stale without the user noticing. Mitigated in the current design by sync failures being visible in the sync command's own output rather than truly silent, but there's no active staleness alerting yet — flagged as an open question in `005-skill-sync-cli.md`.
