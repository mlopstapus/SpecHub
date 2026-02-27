# Inline Team Name Editing

**Date:** 2026-02-26T16:30:00-06:00

## Executive Summary

Allow team owners and admins to edit team names directly in the admin dashboard's
detail panel. The backend already supports this via `PUT /api/v1/teams/{team_id}`
with owner/admin/parent-owner authorization. This plan covers the frontend UI
change and backend test coverage for authorization scenarios.

---

## Current State

- **Backend:** `PUT /api/v1/teams/{team_id}` accepts `{ name?, description?, owner_id? }`.
  Authorization checks: admin role, team `owner_id` match, or parent team `owner_id` match.
- **Frontend:** `teams/page.tsx` detail panel shows team name as static `<h2>` text (line 702).
  `Pencil` and `Check` icons are imported. `updateTeam()` exists in `lib/api.ts`.
- **Tests:** `test_hierarchy.py::test_update_team` covers happy path with mock admin only.

## Tasks

### 1. Frontend — Inline team name editing (~15 min)

- Add `editingTeamName` (boolean) and `editTeamNameValue` (string) state variables
- In the detail panel header, add a Pencil icon button next to the team name
- On click: replace `<h2>` with an `<Input>` pre-filled with the current name,
  plus a Check button to confirm and X/Escape to cancel
- On save: call `updateTeam(selectedTeam.id, { name: editTeamNameValue })`,
  update `selectedTeam` with the response, reload the tree
- **Dependencies:** None — uses existing `updateTeam()` API client and icons

### 2. Backend tests — Authorization coverage (~10 min)

- Add tests in `test_hierarchy.py` that create a dedicated client fixture
  with a non-admin user to verify:
  - Team owner can update team name → 200
  - Parent team owner can update team name → 200
  - Non-owner, non-admin user gets → 403
- **Dependencies:** Need to create users with specific ownership and test
  auth via direct service/router calls (test client overrides auth as admin)

**Note:** The current test fixture always injects a mock admin user. True
authorization tests require either a second client fixture with a non-admin
user, or direct router-level testing. For now, we'll add a targeted integration
test that exercises the authorization logic by calling the service layer directly.

### 3. Verify (~5 min)

- Run `python -m pytest tests/ -v` — all tests pass
- Run `npm run build` in frontend — compiles without errors

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Slug out of sync after name edit | Don't auto-update slug — slug is an immutable identifier |
| Stale tree after rename | Reload tree after successful save |
| Test auth override masks real auth bugs | Note in plan; full RBAC tests deferred to future RBAC epic |

---

## Acceptance Criteria

1. Clicking the pencil icon next to a team name opens an inline editor
2. Saving updates the name in the detail panel and sidebar tree immediately
3. Escape or X cancels without saving
4. Backend tests confirm owner and admin can update; non-owner cannot
5. All existing tests continue to pass
