# User-Scoped Prompts & Workflows with Sharing

## Overview

Make prompts and workflows truly user-scoped: each belongs to its creator and is only visible to them by default. Users can share prompts/workflows with other users via a share button on the tile card. Shared items appear in the recipient's list as read-only.

---

## Current State

- **Prompts** have an optional `user_id` FK but `list_prompts` returns all prompts regardless of owner.
- **Workflows** have a required `user_id` FK and `list_workflows` already accepts a `user_id` filter, but the frontend doesn't use it.
- Neither has a sharing mechanism.

## Design

### New Tables

**`prompt_shares`** — tracks which users a prompt is shared with

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `prompt_id` | UUID | FK → prompts.id, NOT NULL |
| `user_id` | UUID | FK → users.id, NOT NULL |
| `created_at` | TIMESTAMPTZ | server_default now() |
| | | UNIQUE(prompt_id, user_id) |

**`workflow_shares`** — tracks which users a workflow is shared with

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `workflow_id` | UUID | FK → workflows.id, NOT NULL |
| `user_id` | UUID | FK → users.id, NOT NULL |
| `created_at` | TIMESTAMPTZ | server_default now() |
| | | UNIQUE(workflow_id, user_id) |

### Backend Changes

| File | Change |
|------|--------|
| `src/pcp_server/models.py` | Add `PromptShare`, `WorkflowShare` models; add `shares` relationship on `Prompt` and `Workflow` |
| `src/pcp_server/schemas.py` | Add `ShareRequest`, `ShareResponse` schemas |
| `alembic/versions/002_sharing.py` | **New.** Migration for `prompt_shares` and `workflow_shares` tables |
| `src/pcp_server/routers/prompts.py` | Add `POST /prompts/{name}/shares`, `GET /prompts/{name}/shares`, `DELETE /prompts/{name}/shares/{user_id}` |
| `src/pcp_server/routers/workflows.py` | Add `POST /workflows/{id}/shares`, `GET /workflows/{id}/shares`, `DELETE /workflows/{id}/shares/{user_id}` |
| `src/pcp_server/services/prompt_service.py` | Update `list_prompts` to accept `user_id` filter (owned + shared). Add `share_prompt`, `unshare_prompt`, `list_shares` |
| `src/pcp_server/services/workflow_service.py` | Update `list_workflows` to include shared. Add `share_workflow`, `unshare_workflow`, `list_shares` |
| `frontend/src/lib/api.ts` | Add share/unshare API functions |
| `frontend/src/app/prompts/page.tsx` | Filter by current user (owned + shared). Add share icon on card |
| `frontend/src/app/workflows/page.tsx` | Filter by current user (owned + shared). Add share icon on card |
| `frontend/src/components/share-dialog.tsx` | **New.** Dialog with user search, share/unshare buttons |
| `tests/test_sharing.py` | **New.** Tests for prompt/workflow sharing |

### Query Logic for "My Prompts"

```sql
SELECT p.* FROM prompts p
WHERE p.user_id = :current_user_id
   OR p.id IN (SELECT ps.prompt_id FROM prompt_shares ps WHERE ps.user_id = :current_user_id)
ORDER BY p.name
```

Same pattern for workflows.

### Frontend UX

- Prompt/workflow cards show a small **Share** icon (Lucide `Share2`) in the top-right corner, visible on hover
- Clicking opens a `ShareDialog` with:
  - List of users the item is currently shared with (with remove button)
  - User search/select to add new shares
- Shared items show a subtle "Shared with you" badge on the card
- Owner can share/unshare; recipients get read-only access

### API Endpoints

```
POST   /api/v1/prompts/{name}/shares       { user_id: UUID }
GET    /api/v1/prompts/{name}/shares       → [{ user_id, username, display_name, created_at }]
DELETE /api/v1/prompts/{name}/shares/{user_id}

POST   /api/v1/workflows/{id}/shares       { user_id: UUID }
GET    /api/v1/workflows/{id}/shares       → [{ user_id, username, display_name, created_at }]
DELETE /api/v1/workflows/{id}/shares/{user_id}
```

---

## Acceptance Criteria

1. Prompts list shows only owned + shared prompts for the current user
2. Workflows list shows only owned + shared workflows for the current user
3. Share button on card opens dialog to add/remove shares
4. Shared items show "Shared with you" indicator
5. Only the owner can share/unshare
6. Existing tests continue to pass
7. New tests cover: share, unshare, list with sharing filter, permission checks

---

## Out of Scope

- Team-wide sharing (share with entire team)
- Permission levels (editor vs viewer) — all shares are read-only for now
- Sharing via link/token
