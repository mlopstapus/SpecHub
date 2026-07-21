---
epic: 002-identity-access
feature: 006-api-keys
status: open
dependencies: ["003-user-accounts-and-registration.md", "backlog/000-foundations/006-auth-and-session-conventions.md"]
---

# API Keys

Port scoped bearer API keys from the current Python `apikey_service.py` — the auth mechanism for MCP and REST API access outside the browser session, used by every IDE connecting to a SpecHub instance.

## Requirements

- [ ] `identity_access.api_keys` table: `id`, `organization_id`, `user_id`, `name`, `key_hash` (SHA-256), `prefix` (short, displayable), `scopes` (jsonb), `expires_at` (nullable), `is_active`, `created_at`, `last_used_at`
- [ ] Key generation: raw key shown exactly once at creation, only the hash + prefix stored thereafter
- [ ] `authenticateApiKey(rawKey)` contract function: hashes the presented key, looks it up, returns `UserSummary` + scopes, or null
- [ ] Revoke key (sets `is_active = false`)
- [ ] `last_used_at` updated on successful authentication (matches current behavior)

## Acceptance Criteria

- [ ] Raw key is never retrievable after creation — verified by a test asserting no API response or DB column contains it in reversible form
- [ ] An expired or revoked key fails authentication
- [ ] `authenticateApiKey` correctly resolves the key's owning organization and user

## Open Questions

- Scope granularity — resolved by `context/auth-conventions.md`; implement whatever that document specifies.

## Dependencies

- `003-user-accounts-and-registration.md`
- `backlog/000-foundations/006-auth-and-session-conventions.md`

## Technical Notes

Directly implements tenet S1 (hashed at rest) and closes the tenet S3 gap explicitly called out in the tenets doc: the current `mcp/tools.py` logs `api_key_raw[:12]` at debug level — this feature's logging must not reproduce that. No log statement anywhere in this feature (or any caller of `authenticateApiKey`) may include any portion of the raw key.
