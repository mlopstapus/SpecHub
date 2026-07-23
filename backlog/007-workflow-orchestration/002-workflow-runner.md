---
epic: 007-workflow-orchestration
feature: 002-workflow-runner
status: open
dependencies: ["001-workflow-model-and-crud.md", "backlog/006-prompt-registry/004-expansion-engine.md"]
---

# Workflow Runner

Port `run_workflow` from the current Python `workflow_service.py` — executes each step in order via Prompt Registry's `expand()`, threading each step's output into the next step's input, and (new) persists run history.

## Requirements

- [ ] `runWorkflow(orgId, workflowId, input)`: executes steps sequentially, calling `expand()` from Prompt Registry for each
- [ ] A failed step's output does not silently flow to the next step as if it succeeded — the failure is recorded and downstream steps receive `null`/an explicit error marker for that step's output, matching `bcs/workflow-orchestration/CONTRACT.md`'s stability guarantee
- [ ] `workflow.workflow_runs` table (new): `id`, `workflow_id`, `organization_id`, `status`, `steps` (jsonb — per-step result including status/error), `outputs` (jsonb), `started_at`, `completed_at` — persists what the current Python implementation discards after the HTTP response
- [ ] `WorkflowRunCompleted`/`WorkflowRunFailed` events per `bcs/workflow-orchestration/CONTRACT.md`, consumed by Audit and by Distribution (usage telemetry)

## Acceptance Criteria

- [ ] A multi-step workflow where step 2 fails: step 3 receives a `null`/explicit-error input for step 2's output, not stale or fabricated data — matching the CONTRACT.md guarantee
- [ ] A completed run is queryable afterward via `workflow_runs`, including per-step results — this is new functionality beyond the current Python behavior, verified by test
- [ ] `runWorkflow` calls `expand()` through Prompt Registry's contract only — no direct import of Prompt Registry internals (module-boundary lint passes)

## Open Questions

- None currently.

## Dependencies

- `001-workflow-model-and-crud.md`
- `backlog/006-prompt-registry/004-expansion-engine.md`

## Technical Notes

The `workflow_runs` persistence is a deliberate, called-out improvement over the current Python behavior (see `bcs/workflow-orchestration/OWNERSHIP.md`) — not scope creep, since it directly supports debugging and the audit story the rest of this architecture is built around.
