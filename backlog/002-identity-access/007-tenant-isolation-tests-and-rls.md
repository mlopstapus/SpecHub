---
epic: 002-identity-access
feature: 007-tenant-isolation-tests-and-rls
status: open
dependencies: ["001-organization-tenant-model.md", "002-team-hierarchy.md", "003-user-accounts-and-registration.md", "006-api-keys.md"]
---

# Tenant Isolation Tests & RLS

Enable Postgres RLS on every `identity_access.*` table and build the reusable cross-tenant-denial test helper that every subsequent bounded-context epic's own tenant-isolation-tests feature will import, per tenets M1/M2/M3. This is the feature that makes multi-tenancy a proven property of the system, not just an assumed one.

## Requirements

- [ ] RLS policies enabled on `organizations`, `teams`, `users`, `invitations`, `api_keys`, keyed off the session variable mechanism from `context/database-conventions.md`
- [ ] Every service-layer query in this epic's other features filters by the caller's `organization_id` — audited/reviewed against this feature, not assumed
- [ ] Shared test helper (e.g. `expectCrossTenantDenied(resourceType, createFn, fetchByIdFn)`) built and exported for reuse by other epics
- [ ] One M3 negative test per resource type in this BC: a user in org A cannot read or write org B's team, user, invitation, or API key by ID

## Acceptance Criteria

- [ ] For every resource type owned by this BC, a test proves cross-org access by ID is denied — not just absent from a list view
- [ ] Disabling the app-layer `organization_id` filter (simulated in a test) still results in denial, because RLS independently blocks it — proves M2's "backstop, not primary control" property actually holds
- [ ] The shared test helper is documented (e.g. a short usage example in `context/testing-strategy.md` or a README in the test utils folder) so later epics can find and use it without re-deriving the pattern

## Open Questions

- None — this is the concrete implementation of the pattern `context/testing-strategy.md` describes abstractly.

## Dependencies

- All other features in this epic (001–003, 006 at minimum — 004/005 benefit but aren't strictly required for the RLS/test-helper work itself)
- `backlog/000-foundations/003-testing-strategy.md`

## Technical Notes

This feature is the direct implementation of tenets M1, M2, and M3 for the Identity & Access BC, and it establishes the pattern (both the RLS policy shape and the test helper) that `004-governance`, `005-prompt-registry`, and `006-workflow-orchestration`'s own tenant-isolation-tests features will reuse rather than reinvent. Treat the test helper's API as a mini-contract of its own — changing its shape later means updating every epic that imports it.
