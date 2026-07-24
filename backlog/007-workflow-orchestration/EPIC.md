# Epic 007: Workflow Orchestration

**Priority:** 7
**Status:** not-started
**Goal:** Port multi-step prompt chains — Workflow's ordered steps, each feeding its output into the next — built entirely on Prompt Registry's `expand()` contract.

## Overview

The smallest of the core-domain epics, since Workflow Orchestration has no template-rendering or governance logic of its own — it's pure sequencing on top of an already-proven expansion engine. The one real addition beyond a straight port: persisting workflow run history (`workflow_runs`), which the current Python implementation discards after the response is sent. That's a deliberate improvement, not scope creep — it directly supports the audit/debugging story the rest of the architecture is built around.

## Features

- [ ] [001 - Workflow Model & CRUD](001-workflow-model-and-crud.md)
- [ ] [002 - Workflow Runner](002-workflow-runner.md)
- [ ] [003 - Workflow Tenant Isolation Tests](003-workflow-tenant-isolation-tests.md)
- [ ] [004 - Workflow Sharing](004-workflow-sharing.md)
- [ ] [005 - Workflow Views UI](005-workflow-views-ui.md)

*Completed features are moved to `archive/` and checked off here.*

## Dependencies

- `backlog/006-prompt-registry/EPIC.md` (workflow steps call `expand()`)
- `backlog/002-identity-access/EPIC.md`
- `backlog/004-app-shell-and-landing/EPIC.md` (feature 005's UI composes into that epic's shell)

## Notes

**Added 2026-07-23**: feature 005 builds this epic's real UI directly, same pattern as `003-audit-compliance/003-audit-log-ui.md` and `005-governance/005-governance-views-ui.md` — but no design mockup exists yet for these pages, so it's currently a stub pending one (see that feature's Open Questions).
