---
epic: 005-prompt-registry
feature: 002-prompt-and-version-model
status: open
dependencies: ["backlog/002-identity-access/EPIC.md"]
---

# Prompt & Version Model

Port `Prompt` and `PromptVersion` from the current Python `models.py`/`prompt_service.py`, correcting `name` uniqueness from global to org-scoped (the same class of multi-tenancy bug fixed for users in epic 002).

## Requirements

- [ ] `prompt_registry.prompts` table: `id`, `organization_id`, `name`, `description`, `is_deprecated`, `active_version_id` (nullable), `user_id` (nullable, owner), timestamps
- [ ] `(organization_id, name)` unique — **not globally unique**, correcting the current schema
- [ ] `prompt_registry.prompt_versions` table: `id`, `prompt_id`, `version`, `system_template` (nullable), `user_template` (nullable), `input_schema` (jsonb), `tags` (jsonb), `created_at` — **immutable once created**, no update path in the application service, only insert
- [ ] CRUD: create prompt, publish new version, deprecate prompt, list/get by name (org-scoped), list versions
- [ ] Rollback: repoint `active_version_id` to a previously published version (matches current `pin_version`/`POST /prompts/{name}/rollback/{version}`) — this only changes which version is "active," it never edits an existing `PromptVersion` row's content, so it doesn't conflict with version immutability above

## Acceptance Criteria

- [ ] Two different organizations can each have a prompt named `commit` with no conflict
- [ ] Within one organization, a second prompt with the same name is rejected
- [ ] No application code path can update an existing `PromptVersion` row — only create new ones (enforced by omitting an update function entirely, not just by convention)
- [ ] Rolling back to an older version updates `active_version_id` only; the rolled-back-to version's own row is untouched, and rolling back does not delete or alter any newer version
- [ ] Every mutation produces a corresponding audit event (`PromptCreated`, `PromptVersionPublished`)

## Open Questions

- None currently.

## Dependencies

- `backlog/002-identity-access/EPIC.md`

## Technical Notes

Per `bcs/prompt-registry/CONTRACT.md`'s stability guarantees, `PromptVersion` immutability is load-bearing for the expansion engine (feature 004) — expansion results must be reproducible against a specific version forever, which breaks if versions can be edited in place.
