---
epic: 002-identity-access
feature: 002-team-hierarchy
status: done
dependencies: ["001-organization-tenant-model.md"]
---

# Team Hierarchy

Port the recursive team hierarchy (`teams.parent_team_id`, `sub_teams`, `get_team_chain`) from the current Python `team_service.py`, scoped under `Organization` instead of being the tenant root itself. `getTeamChain` is a stability-guaranteed contract function per `bcs/identity-access/CONTRACT.md` — Governance's resolution correctness depends on its ordering never changing.

## Requirements

- [X] `identity_access.teams` table: `id`, `organization_id`, `name`, `slug`, `description`, `owner_id` (nullable, FK to `users`), `parent_team_id` (nullable, self-FK), timestamps
- [X] Invariant enforced: `parent_team_id`, if set, must belong to the same `organization_id` as the child — reject cross-org reparenting
- [X] Invariant enforced: no cycles in the team tree (reject a reparent that would create one)
- [X] `getTeamChain(teamId)` returns ordered `TeamChainEntry[]`: self-first, root-last — matches current Python `get_team_chain` behavior exactly (characterization test against it)
- [X] CRUD operations: create team, update team, reparent team, list sub-teams
- [X] Insert-between: create a new team and splice it into the hierarchy between an existing team and its current parent (the existing team is reparented under the new one) — matches current `insert_team_between`/`POST /teams/insert-between/{child_team_id}`

## Acceptance Criteria

- [X] `getTeamChain` output matches the current Python implementation's output for an equivalent multi-level hierarchy fixture, verified by a characterization test
- [X] Attempting to set `parent_team_id` to a team in a different organization is rejected
- [X] Attempting to create a cycle (A's parent is B, B's parent is A) is rejected
- [X] `TeamReparented` event fires on successful reparent (consumed by Audit per `bcs/governance/CONTRACT.md`'s note that Governance itself doesn't need to react, but Audit does) — **exception, marked done by explicit user decision 2026-07-22 despite this criterion not being independently implemented**: per PDR-007 there is no event bus in this system, so this is really "team reparents get an audit-log row once the audit write path exists," which requires `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`, not yet built. That item's retrofit requirement already explicitly lists team creation/reparenting. Same "mark done anyway, forward-track the gap" call already made for `001-organization-tenant-model.md`'s equivalent bootstrap-completeness criterion — see `[[project_epic_002_progress]]` memory.

## Open Questions

- None currently.

## Dependencies

- `001-organization-tenant-model.md`

## Technical Notes

Per D2 (tenet), the cycle-detection and cross-org-reparenting invariants belong in this feature's application service, not in a router/route-handler — they must apply identically whether the caller is the REST API or (eventually) an admin MCP tool. Per `bcs/identity-access/CONTRACT.md`'s Breaking Change Policy, `getTeamChain`'s ordering is a stability guarantee — any change here requires updating that CONTRACT.md in the same commit.
