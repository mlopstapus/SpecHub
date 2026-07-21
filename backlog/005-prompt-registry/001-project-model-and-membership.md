---
epic: 005-prompt-registry
feature: 001-project-model-and-membership
status: open
dependencies: ["backlog/002-identity-access/EPIC.md"]
---

# Project Model & Membership

Port `Project` and `ProjectMember` from the current Python `models.py`/`project_service.py` — a team-owned workspace with cross-team members, scoped under `Organization`.

## Requirements

- [ ] `prompt_registry.projects` table: `id`, `organization_id`, `team_id`, `lead_user_id` (nullable), `name`, `slug`, `description`, timestamps
- [ ] `prompt_registry.project_members` table: `id`, `project_id`, `user_id`, `role`, `created_at`, unique on `(project_id, user_id)`
- [ ] Invariant: `team_id`, `lead_user_id`, and every member's `user_id` must belong to the project's `organization_id`
- [ ] CRUD: create project, add/remove member, update project, list projects by team/org

## Acceptance Criteria

- [ ] Adding a member from a different organization is rejected
- [ ] `(project_id, user_id)` uniqueness enforced — can't add the same member twice
- [ ] Every mutation produces a corresponding audit event

## Open Questions

- None currently.

## Dependencies

- `backlog/002-identity-access/EPIC.md`

## Technical Notes

Cross-team membership within the same org is intentional (matches current Python model) — only cross-*organization* membership is invalid, per M1.
