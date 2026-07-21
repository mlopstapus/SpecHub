---
epic: 006-workflow-orchestration
feature: 003-workflow-tenant-isolation-tests
status: open
dependencies: ["001-workflow-model-and-crud.md", "002-workflow-runner.md", "004-workflow-sharing.md", "backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md"]
---

# Workflow Tenant Isolation Tests

Apply RLS and the shared cross-tenant-denial test helper to `workflow.workflows` and `workflow.workflow_runs`, per tenets M1/M2/M3.

## Requirements

- [ ] RLS policies enabled on `workflows`, `workflow_runs`, and `workflow_shares`
- [ ] Every query in this epic's other features filters by `organization_id`, audited against this feature
- [ ] M3 negative test: a user in org A cannot read or run org B's workflow by ID, cannot read org B's `workflow_runs` by ID, and cannot share/unshare a workflow they don't own or have admin rights to

## Acceptance Criteria

- [ ] Cross-org access to a workflow or its run history by ID is denied, proven by test
- [ ] RLS independently blocks cross-org access with the app-layer filter simulated as absent

## Open Questions

- None.

## Dependencies

- `001-workflow-model-and-crud.md`
- `002-workflow-runner.md`
- `004-workflow-sharing.md`
- `backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md`

## Technical Notes

Reuses the shared test helper from epic 002.
