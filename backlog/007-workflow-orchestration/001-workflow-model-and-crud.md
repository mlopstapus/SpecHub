---
epic: 007-workflow-orchestration
feature: 001-workflow-model-and-crud
status: open
dependencies: ["backlog/002-identity-access/EPIC.md"]
---

# Workflow Model & CRUD

Port `Workflow` from the current Python `models.py`/`workflow_service.py`, scoped under `Organization`.

## Requirements

- [ ] `workflow.workflows` table: `id`, `organization_id`, `user_id`, `project_id` (nullable), `name`, `description`, `steps` (jsonb), timestamps
- [ ] Invariant: `project_id`, if set, must belong to the same `organization_id`
- [ ] CRUD: create, update, list workflows (by user/project/org)

## Acceptance Criteria

- [ ] Creating a workflow scoped to a project from a different organization is rejected
- [ ] Every mutation produces a corresponding audit event

## Open Questions

- None currently.

## Dependencies

- `backlog/002-identity-access/EPIC.md`

## Technical Notes

`steps` structure (referencing prompt names, not IDs — matching current Python behavior) is validated for shape but not resolved against Prompt Registry until run time, per the current implementation's lazy-lookup approach.
