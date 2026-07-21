---
epic: 005-prompt-registry
feature: 005-prompt-registry-tenant-isolation-tests
status: open
dependencies: ["001-project-model-and-membership.md", "002-prompt-and-version-model.md", "003-prompt-sharing.md", "backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md"]
---

# Prompt Registry Tenant Isolation Tests

Apply RLS and the shared cross-tenant-denial test helper to `prompt_registry.projects`, `prompt_registry.prompts`, `prompt_registry.prompt_versions`, and `prompt_registry.prompt_shares`, per tenets M1/M2/M3.

## Requirements

- [ ] RLS policies enabled on all four tables in this schema
- [ ] Every query in this epic's other features filters by `organization_id`, audited against this feature
- [ ] M3 negative test per resource type: a user in org A cannot read or write org B's project, prompt, or version by ID

## Acceptance Criteria

- [ ] Cross-org access by ID is denied for each resource type, proven by test
- [ ] RLS independently blocks cross-org access with the app-layer filter simulated as absent

## Open Questions

- None.

## Dependencies

- `001-project-model-and-membership.md`
- `002-prompt-and-version-model.md`
- `003-prompt-sharing.md`
- `backlog/002-identity-access/007-tenant-isolation-tests-and-rls.md`

## Technical Notes

Reuses the shared test helper from epic 002. Prompt sharing (feature 003) is intra-org by design — this feature's tests confirm cross-*org* access is denied, not that sharing itself is restrictive within an org.
