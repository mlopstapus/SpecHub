---
epic: 004-governance
feature: 002-objective-model-and-crud
status: open
dependencies: ["backlog/002-identity-access/EPIC.md"]
---

# Objective Model & CRUD

Port `Objective` from the current Python `models.py`/`objective_service.py`, scoped under `Organization`. Unlike Policy, Objective supports its own internal parent/child tree (`parent_objective_id`) in addition to team/project/user scoping.

## Requirements

- [ ] `governance.objectives` table: `id`, `organization_id`, `team_id` (nullable), `project_id` (nullable), `user_id` (nullable), `title`, `description`, `parent_objective_id` (nullable, self-FK), `is_inherited`, `status`, `created_at`
- [ ] Invariant: `team_id`/`project_id`/`user_id`, if set, must belong to the caller's `organization_id`
- [ ] Invariant: no cycles in `parent_objective_id` chains
- [ ] CRUD operations matching current Python service behavior
- [ ] All mutations go through `withAudit()` — `ObjectiveCreated`/`ObjectiveUpdated` events per `bcs/governance/CONTRACT.md`

## Acceptance Criteria

- [ ] Objective scoping (team/project/user) is validated against the caller's organization
- [ ] Cyclic `parent_objective_id` chains are rejected
- [ ] Every mutation produces a corresponding audit event

## Open Questions

- None currently.

## Dependencies

- `backlog/002-identity-access/EPIC.md`
- `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`

## Technical Notes

Mirrors `001-policy-model-and-crud.md`'s invariant-placement approach (tenet D2) — scoping and cycle-detection rules live in the application service, shared where reasonable between Policy and Objective given their structural similarity.
