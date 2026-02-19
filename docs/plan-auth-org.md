# Auth & Organization Feature Plan

**Date:** 2026-02-19
**Status:** Draft — awaiting user confirmation

---

## Executive Summary

Add real authentication to SpecHub so that a person can sign up, create an organization (the root team), and become its admin. From there, the admin can invite others to join the organization and assign them to teams. This replaces the current open-access model where anyone can create teams/users via the API.

The approach uses **email + password auth with JWT tokens**, keeping the system self-hosted and dependency-free (no external auth provider required). The existing `User` model gains a `password_hash` and `role` field. A new `Invitation` model handles the invite flow. The frontend gets a login/register page and an invite management UI.

---

## Key Decisions to Confirm

1. **Auth method:** Email + password with JWT (no OAuth/OIDC for now — keeps it self-hosted simple). Sound good?
2. **Organization = root team:** The first user signs up, creates an org name → that becomes the root team, and they become its `admin` owner. All subsequent users join via invitation only.
3. **Roles:** `admin` (full control, invite, manage teams) and `member` (use prompts, manage own API keys). Admins can promote others. Enough for now?
4. **Invite flow:** Admin enters an email → system creates an invitation with a unique token → invitee visits `/invite/{token}` → sets password, gets assigned to a team chosen by the admin.
5. **Existing API keys** continue to work for MCP/programmatic access (bearer token). JWT is for the dashboard/REST API sessions.

---

## Phases

### Phase 1: Backend Auth Foundation

**Models:**
- Add to `User`: `password_hash` (nullable — existing users get migrated), `role` (admin/member)
- New `Invitation` model: `id`, `email`, `team_id`, `role`, `token` (unique), `invited_by` (FK → users), `accepted_at`, `expires_at`, `created_at`
- Alembic migration `003_auth.py`

**Config:**
- Add `jwt_secret` to Settings (auto-generated default for dev)
- Add `jwt_expiry_hours` (default 24)

**Dependencies:**
- `passlib[bcrypt]` for password hashing
- `python-jose[cryptography]` for JWT

**Service layer:**
- `auth_service.py`: `register_admin()`, `login()`, `hash_password()`, `verify_password()`, `create_jwt()`, `decode_jwt()`
- `invitation_service.py`: `create_invitation()`, `accept_invitation()`, `list_invitations()`

**Auth middleware:**
- FastAPI dependency `get_current_user()` — extracts JWT from `Authorization: Bearer <token>` header, returns the `User` or raises 401
- Dual-mode: accepts both JWT tokens (dashboard) and API keys (MCP/programmatic)

### Phase 2: Auth API Endpoints

**New router `auth.py`:**
- `POST /api/v1/auth/register` — first user only; creates org (root team) + admin user; returns JWT
- `POST /api/v1/auth/login` — email + password → JWT
- `GET /api/v1/auth/me` — returns current user + team + role
- `POST /api/v1/auth/invitations` — admin creates invitation (email, team_id, role)
- `GET /api/v1/auth/invitations` — admin lists pending invitations
- `DELETE /api/v1/auth/invitations/{id}` — admin revokes invitation
- `POST /api/v1/auth/invitations/{token}/accept` — invitee sets password, joins org

**Protect existing endpoints:**
- All mutating endpoints require auth (create/update/delete on teams, users, policies, etc.)
- Read endpoints and expand endpoints remain open (or optionally require API key)
- Team/user creation endpoints become admin-only (no more anonymous user creation)

### Phase 3: Frontend Auth

**New pages:**
- `/login` — email + password form
- `/register` — org name + admin email + password (only works if no org exists yet)
- `/invite/{token}` — accept invitation form (set display name + password)

**Auth state:**
- React context provider storing JWT + current user
- Auto-redirect to `/login` if not authenticated
- Navbar shows current user, logout button
- Admin-only UI elements (invite button, team management) hidden for members

**Invite management:**
- Settings page gets an "Invitations" section (admin only)
- Form: email + team selector + role selector → sends invite
- List of pending invitations with revoke button

### Phase 4: Tests & Migration Safety

- Auth tests: register, login, JWT validation, invitation flow
- Permission tests: member can't create teams, admin can
- Migration test: existing data survives the migration (nullable password_hash)
- Update existing tests to include auth headers where needed

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking existing MCP connections | API keys continue to work unchanged; JWT is additive |
| Breaking existing tests | Tests use a test client that bypasses auth; add auth override fixture |
| Password security | bcrypt with proper work factor; never store plaintext |
| JWT secret management | Auto-generated for dev; must be set via env var in production |
| Single-org assumption | For now, one org per PCP instance; multi-org is a future extension |

---

## Out of Scope (Future)

- OAuth / OIDC / SSO
- Multi-organization per instance
- Fine-grained permissions (per-project, per-prompt)
- Password reset flow (email sending)
- Session refresh tokens

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Backend auth foundation | Medium |
| Phase 2: Auth API endpoints | Medium |
| Phase 3: Frontend auth | Medium |
| Phase 4: Tests | Small |
| **Total** | ~4 phases, similar to the hierarchy refactor |
