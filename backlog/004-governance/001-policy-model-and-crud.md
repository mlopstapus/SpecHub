---
epic: 004-governance
feature: 001-policy-model-and-crud
status: open
dependencies: ["backlog/002-identity-access/EPIC.md"]
---

# Policy Model & CRUD

Port `Policy` from the current Python `models.py`/`policy_service.py`'s create/get/update/delete/list operations, scoped under `Organization`.

## Requirements

- [ ] `governance.policies` table: `id`, `organization_id`, `team_id` (nullable), `project_id` (nullable), `name`, `description`, `enforcement_type` (`prepend`/`append`/`inject`/`validate`), `content`, `priority`, `is_active`, `created_at`
- [ ] Invariant: exactly one of `team_id`/`project_id` is set, never both, never neither
- [ ] Invariant: `team_id`/`project_id`, if set, must belong to the caller's `organization_id`
- [ ] CRUD operations matching current Python service behavior: `createPolicy`, `getPolicy`, `updatePolicy`, `deletePolicy`, `listTeamPolicies`, `listProjectPolicies`
- [ ] All mutations go through `withAudit()` — `PolicyCreated`/`PolicyUpdated`/`PolicyDeactivated` events per `bcs/governance/CONTRACT.md`

## Acceptance Criteria

- [ ] Creating a policy with both `team_id` and `project_id` set is rejected
- [ ] Creating a policy with neither set is rejected
- [ ] `listTeamPolicies`/`listProjectPolicies` only return active policies, ordered by priority descending, matching current Python behavior
- [ ] Every mutation produces a corresponding audit event

## Open Questions

- None currently.

## Dependencies

- `backlog/002-identity-access/EPIC.md`
- `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`

## Technical Notes

Per tenet D2, the "exactly one of team/project" and "same organization" invariants live in this feature's application service, not in a router — the current Python `routers/policies.py`'s `_authorize_policy_team` is exactly the kind of router-level business logic tenet D2 exists to eliminate.
