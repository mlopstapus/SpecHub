# Epic 006: Workflow Orchestration

**Priority:** 6
**Status:** not-started
**Goal:** Port multi-step prompt chains — Workflow's ordered steps, each feeding its output into the next — built entirely on Prompt Registry's `expand()` contract.

## Overview

The smallest of the core-domain epics, since Workflow Orchestration has no template-rendering or governance logic of its own — it's pure sequencing on top of an already-proven expansion engine. The one real addition beyond a straight port: persisting workflow run history (`workflow_runs`), which the current Python implementation discards after the response is sent. That's a deliberate improvement, not scope creep — it directly supports the audit/debugging story the rest of the architecture is built around.

## Features

- [ ] [001 - Workflow Model & CRUD](001-workflow-model-and-crud.md)
- [ ] [002 - Workflow Runner](002-workflow-runner.md)
- [ ] [003 - Workflow Tenant Isolation Tests](003-workflow-tenant-isolation-tests.md)
- [ ] [004 - Workflow Sharing](004-workflow-sharing.md)

*Completed features are moved to `archive/` and checked off here.*

## Dependencies

- `backlog/005-prompt-registry/EPIC.md` (workflow steps call `expand()`)
- `backlog/002-identity-access/EPIC.md`

## Notes

None beyond what's captured in the individual features.
