# Show MCP Server Config After API Key Creation

**Date:** 2026-02-27T09:40:00-06:00

## Executive Summary

When a user creates an API key on the Settings page, show a ready-to-copy MCP
server configuration snippet (JSON) alongside the raw key. This lets users
immediately paste the config into their IDE (e.g. Windsurf `mcp_config.json`)
without having to manually construct it.

---

## Current State

- **API key creation flow:** `settings/page.tsx` shows a banner with the raw key
  after creation (lines 319-353). Only a copy button for the raw key exists.
- **MCP endpoint:** Mounted at `/mcp/` on the backend (`main.py:59`). Uses
  streamable-HTTP transport with `Authorization: Bearer <pcp_key>`.
- **Server URL:** Currently hardcoded to `http://localhost:8000` in dev. In
  production it's the backend host. The frontend already knows the API base URL
  via `lib/api.ts`.

## Tasks

### 1. Frontend — MCP config snippet in raw-key banner (~15 min)

- After API key creation, generate a JSON config object:
  ```json
  {
    "mcpServers": {
      "spechub": {
        "serverUrl": "<backend_origin>/mcp/",
        "headers": {
          "Authorization": "Bearer <raw_key>"
        }
      }
    }
  }
  ```
- Display it in a `<pre>` code block below the raw key in the existing banner
- Add a second "Copy Config" button that copies the full JSON snippet
- Derive `<backend_origin>` from the existing API base URL in `lib/api.ts`

### 2. Tests — Frontend build check (~5 min)

- Run `npm run build` to verify no compile errors

### 3. Verify (~5 min)

- Run `python -m pytest tests/ -v` — all existing tests pass
- Visual check: create a key, see the config snippet, copy it

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Backend URL differs between environments | Derive from existing API base URL at runtime |
| Config format changes across IDEs | Use standard MCP config format; add a note that it's for Windsurf/Cursor |

---

## Acceptance Criteria

1. After creating an API key, a copyable MCP server config JSON is displayed
2. The config includes the correct server URL and Bearer token
3. A "Copy Config" button copies the full JSON to clipboard
4. All existing tests continue to pass
