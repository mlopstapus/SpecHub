# Epic 007: Distribution

**Priority:** 7
**Status:** not-started
**Goal:** Compose all six prior bounded contexts into the actual external surface — REST API, MCP protocol server, and web UI — so the self-hosted Free tier is fully usable end-to-end.

## Overview

Distribution has no domain rules of its own; this epic is entirely about correct composition, protocol translation, and preserving the existing MCP tool contract (`sh-list`, `sh-search`, `sh-context`, `sh-run`, `sh-workflow-list`, `sh-workflow-run`) that every connected IDE's config already points at. When this epic ships, the refactor's core-product scope is complete — everything that exists in the current Python app now exists in the new TS app, correctly tenant-scoped, tested, and audited. Billing (epic 008) is the only thing still missing, and Free-tier self-hosted installs don't need it at all.

## Features

- [ ] [001 - REST API Core Routes](001-rest-api-core-routes.md)
- [ ] [002 - MCP Server & Tools](002-mcp-server-and-tools.md)
- [ ] [003 - Web UI Shell & Core Pages](003-web-ui-shell-and-core-pages.md)
- [ ] [004 - Usage Telemetry](004-usage-telemetry.md)

*Completed features are moved to `archive/` and checked off here.*

## Dependencies

- `backlog/002-identity-access/EPIC.md`
- `backlog/003-audit-compliance/EPIC.md`
- `backlog/004-governance/EPIC.md`
- `backlog/005-prompt-registry/EPIC.md`
- `backlog/006-workflow-orchestration/EPIC.md`
- `backlog/000-foundations/004-api-and-error-conventions.md`

## Notes

Feature 002 (MCP) carries the highest external-compatibility risk in this epic — any change to tool names or argument shapes breaks every already-configured IDE. Treat it as a strict compatibility port, not a redesign opportunity.
