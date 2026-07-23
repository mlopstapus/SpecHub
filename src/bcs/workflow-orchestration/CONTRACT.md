# Workflow Orchestration — Contract

**Owner:** Ben Anderson
**Status:** Draft

## Purpose

Owns `Workflow` — a named, ordered chain of prompt expansions where each step's output feeds the next step's input. Built entirely on top of Prompt Registry's `expand()` contract; has no template-rendering or governance logic of its own.

## Exposed APIs

| Endpoint / Method | Description | Consumers |
|---|---|---|
| `listWorkflows(orgId, userId)` | Workflows accessible to the user | Distribution (`sh-workflow-list`) |
| `runWorkflow(orgId, workflowId, input)` | Runs all steps in order, threading outputs forward, returns per-step results + final outputs | Distribution (`sh-workflow-run`) |
| `createWorkflow`, `updateWorkflow` | Standard write operations | Distribution (route handlers) |

## Events Published

| Event | Payload summary | Consumers |
|---|---|---|
| `WorkflowCreated` | orgId, workflowId, actorUserId | Audit |
| `WorkflowRunCompleted` / `WorkflowRunFailed` | orgId, workflowId, stepResults summary | Audit, Distribution (usage metrics) |

## Events Consumed

| Event | From BC | What this BC does with it |
|---|---|---|
| none | — | Calls Prompt Registry synchronously per step; no reactive behavior |

## Data Contracts

```ts
interface WorkflowStepResult {
  stepId: string; promptName: string; promptVersion: string;
  status: "success" | "error"; systemMessage?: string; userMessage?: string; error?: string;
}
interface WorkflowRunResult {
  workflowName: string; steps: WorkflowStepResult[]; outputs: Record<string, unknown>;
}
```

## Stability Guarantees

Step execution order is strictly sequential and stops recording further steps' inputs from a failed step's output as `null` rather than guessing — failure in step N does not silently skip to step N+1 with stale data.

## Breaking Change Policy

Changes to how a failed step affects downstream steps require a PDR — this is user-visible behavior IDEs will build around.
