# Workflow Orchestration — Ownership

**Owner:** Ben Anderson

## Folder Ownership

| Path | Ownership level |
|---|---|
| `/bcs/workflow-orchestration/` | Full |
| `src/bcs/workflow-orchestration/` | Full |
| `src/app/(app)/workflows/*` (UI) | Full |

## Database Ownership

Postgres schema: `workflow`

| Schema / Table | Notes |
|---|---|
| `workflow.workflows` | `steps` as jsonb; org + optional project scoped |
| `workflow.workflow_runs` | **New** vs. the current Python model — persists run history (status, outputs, timestamps) per step for audit/debugging instead of discarding it after the response is sent |

## Shared Resource Ownership

None.

## Dependencies (owned by others)

| Resource | Owned by BC |
|---|---|
| `expand()` | Prompt Registry |
| User/project existence | Identity & Access, Prompt Registry |
