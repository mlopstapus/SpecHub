---
epic: 005-prompt-registry
feature: 003-prompt-sharing
status: open
dependencies: ["002-prompt-and-version-model.md"]
---

# Prompt Sharing

Port `PromptShare` from the current Python `models.py`/`prompt_service.py` — grants a specific user access to a prompt they don't own, scoped to remain within one organization.

## Requirements

- [ ] `prompt_registry.prompt_shares` table: `id`, `prompt_id`, `user_id`, `created_at`, unique on `(prompt_id, user_id)`
- [ ] Invariant: shared-with `user_id` must belong to the same `organization_id` as the prompt — no cross-org sharing
- [ ] Create share, revoke share, list a user's accessible prompts (owned + shared)

## Acceptance Criteria

- [ ] Attempting to share a prompt with a user from a different organization is rejected
- [ ] A user's "accessible prompts" list correctly includes both owned and shared-with prompts
- [ ] Revoking a share removes the prompt from that user's accessible list

## Open Questions

- None currently.

## Dependencies

- `002-prompt-and-version-model.md`

## Technical Notes

This is the access-control input to the "not found or not shared with you" check on prompt expansion — used by epic 007's REST expand route (and, in turn, its skill-sync CLI feature) today, and by the MCP feature's `sh-run` if that's built later. Keep the accessible-prompts query here as the single source of truth Distribution calls into, rather than each caller re-deriving access logic itself.
