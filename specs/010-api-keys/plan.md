# Implementation Plan: API Keys

**Branch**: `010-api-keys` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-api-keys/spec.md`

## Summary

Port scoped bearer API keys from the legacy Python `apikey_service.py` as new `identity-access` application-layer functions — `createApiKey`, `authenticateApiKey`, `revokeApiKey`, `listApiKeys` — backed by a new `identity_access.api_keys` table. Scopes are validated structurally (`<resource>:<action>`, not a closed enum) and capped at the creating user's own role (admin: any scope; member: `:read` only) per this feature's `/speckit-clarify` answers. Raw key material is shown exactly once at creation and never stored — only a SHA-256 hash plus a short display prefix persist. `authenticateApiKey` also re-checks the owning user's liveness (deactivated users' keys stop authenticating), and revocation/listing follow the self-or-admin ownership pattern already established by `updateUser`.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 24 (repo-wide, per `package.json` engines)

**Primary Dependencies**: Drizzle ORM (`drizzle-orm`), `postgres` (postgres-js driver), `node:crypto` (built-in — key generation via `randomBytes`, hashing via `createHash("sha256")`, no new dependency)

**Storage**: PostgreSQL. One new table, `identity_access.api_keys` (org + user scoped, unique `key_hash`).

**Testing**: Vitest, Testcontainers-backed integration tests via `startTestDb()` for anything touching the DB (`create-api-key.test.ts`, `authenticate-api-key.test.ts`, `revoke-api-key.test.ts`, `list-api-keys.test.ts`, `api-keys-repo.test.ts`, `schema.test.ts` additions for the real-migration constraint checks), matching `invite-user.test.ts`/`schema.test.ts` precedent; pure-function unit tests (Vitest, no container) for `domain/api-key.ts`'s scope-shape and permission-cap functions.

**Target Platform**: Next.js server runtime (Node), self-hosted via Docker Compose or managed SaaS

**Project Type**: Web application — this slice is backend-only: `src/bcs/identity-access/{domain,application,infrastructure}` (API key CRUD + authentication). No route handler or UI page is added — same deferral `007-user-accounts-registration`/`008-jwt-session-auth`/`009-invitations` already established for this epic (research.md §5).

**Performance Goals**: No feature-specific target beyond standard web-app expectations; not otherwise specified by spec.md.

**Constraints**: Raw key material exists only transiently in memory during creation and in the single creation-response value — never persisted, logged, or reconstructible (FR-003/FR-004/FR-011, tenet S1/S3). Scope validation happens in two independent steps, both required before any write: shape (`<resource>:<action>`) and permission cap (creator's role) — research.md §1–2. Authentication (`authenticateApiKey`) must never throw for any input, including garbage strings (FR-005) — hashing is safe for any string, so this falls out naturally rather than needing explicit try/catch. No log statement anywhere in this feature (or any caller of `authenticateApiKey`) may include any portion of the raw key (FR-011, tenet S3) — `key_hash` is already in `audit-compliance`'s `REDACTED_KEYS` list, and no code path in this feature logs the raw value at all (research.md §3).

**Scale/Scope**: ~10 new files across `identity-access` (`domain/api-key.ts`, `infrastructure/api-keys-repo.ts` + test, `application/{create,authenticate,revoke,list}-api-key.ts` + tests, `infrastructure/schema.ts` addition + `schema.test.ts` additions, `index.ts` additions); one new migration (`identity_access.api_keys`); no new dependencies; no new env vars.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First**: Every function below (scope-shape validation, permission-cap validation for both roles, raw-key-shown-once, hash-only persistence, revoked/expired/malformed-key rejection, last-used-at update on success only, self-or-admin revoke authorization, self-or-admin list authorization, cross-org denial, deactivated-owner denial) gets a failing test first, per `invite-user.test.ts`/`update-user.test.ts` precedent. PASS.
- **II. Domain-Driven Bounded Contexts**: New code stays under `src/bcs/identity-access/{domain,application,infrastructure}`, exported only via its own `index.ts`. Scope validation deliberately does *not* reach into any other bounded context's resource definitions (research.md §1) — the concrete expression of this principle for this feature. Audit writes go through `audit-compliance`'s `record()` via `withAudit()`, never a direct table write. PASS.
- **III. Domain Invariants in the Domain Layer**: Scope-shape validation, the permission cap, and the "raw key shown once" rule all live in `domain/api-key.ts`/`application/create-api-key.ts`, not deferred to a future route handler. PASS.
- **IV. Multi-Tenant Isolation by Default**: `identity_access.api_keys` carries `organization_id` (M1, not null, no FK per this codebase's established `organization_id`-carries-no-FK precedent — `CLAUDE.md`). Every repo query filtering by organization is scoped explicitly (M1). RLS (M2) is **not** enabled on this table in this feature — same deferral `identity_access.teams`/`users`/`invitations` already carry, owned by `007-tenant-isolation-tests-and-rls.md`. A negative cross-org test is included for `listApiKeys`' `targetUserId` path and for `revokeApiKey` (M3). PASS, with the same documented RLS deferral prior features in this epic already carry.
- **V. Secure by Default**: Keys are hashed at rest via SHA-256 (tenet S1, backlog item's explicit requirement); the raw value is never stored and returned exactly once (FR-003/FR-004). No log statement anywhere in this feature's code includes any portion of the raw key (FR-011, tenet S3 — the specific gap this backlog item calls out by name from the legacy `mcp/tools.py`). `key_hash` is already covered by `audit-compliance`'s pre-existing `REDACTED_KEYS` list, so no change needed there. PASS.
- **VI. Auditable & Compliant (SOC2)**: API key creation and revocation are each audited (FR-012) via `withAudit()`, following the same pattern `009-invitations` established as the first real (non-test) caller. Authentication itself is *not* audited per-call (FR-007 only requires `last_used_at`, not an audit event) — consistent with `authenticateSession` also performing no audit write for session checks; only the state-changing actions (create/revoke) are audited, matching this codebase's existing audit scope ("every mutation," not every read/auth-check). PASS.
- **VII. Feature-Gated by Entitlement**: No new REST route, MCP tool, or UI surface is added by this feature — same reasoning as `007-user-accounts-registration`/`008-jwt-session-auth`/`009-invitations`. N/A.

*Re-checked after Phase 1 design below — no new violations introduced by the data model or contracts.*

## Project Structure

### Documentation (this feature)

```text
specs/010-api-keys/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── identity-access-api-keys.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
src/bcs/identity-access/
├── domain/
│   └── api-key.ts                       # ApiKey, ApiKeySummary types; isValidScopeShape, isScopeAllowedForRole; error classes
├── application/
│   ├── create-api-key.ts                # createApiKey(db, actingUser, params)
│   ├── create-api-key.test.ts
│   ├── authenticate-api-key.ts          # authenticateApiKey(db, rawKey)
│   ├── authenticate-api-key.test.ts
│   ├── revoke-api-key.ts                # revokeApiKey(db, actingUser, keyId)
│   ├── revoke-api-key.test.ts
│   ├── list-api-keys.ts                 # listApiKeys(db, actingUser, targetUserId?)
│   └── list-api-keys.test.ts
├── infrastructure/
│   ├── schema.ts                        # add api_keys table
│   ├── schema.test.ts                   # add api_keys constraint assertions (real migration)
│   ├── api-keys-repo.ts                 # insert, findByHash, findByOrgAndId, listByOrgAndUser, updateLastUsedAt, markRevoked
│   └── api-keys-repo.test.ts
└── index.ts                             # add createApiKey, authenticateApiKey, revokeApiKey, listApiKeys exports + types

drizzle/migrations/
└── <timestamp>_identity_access_api_keys.sql   # generated via `pnpm db:generate`, renamed per context/database-conventions.md

bcs/identity-access/CONTRACT.md          # fill in the four functions' real signatures (already listed as forward-looking entries); add listApiKeys
```

**Structure Decision**: Follows the existing `src/bcs/<context>/{domain,application,infrastructure}` layout exactly — no new shared kernel module is needed (unlike `009-invitations`' `shared/email`/`shared/logging` additions), since this feature only needs `node:crypto`, already-existing `shared/db` primitives, and the already-existing `audit-compliance` contract. No `src/app/` route or UI is added: the actual key-management HTTP endpoints and any settings-UI surface remain owned by `backlog/007-distribution`'s routing and UI-shell items, consistent with this epic's established precedent.

## Complexity Tracking

> Documented, justified exceptions from the Constitution Check above — not violations requiring a different approach, but deliberate scope boundaries this feature cannot close alone.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| No RLS policy on `identity_access.api_keys` (Principle IV/M2) | Same, already-tracked gap `identity_access.teams`/`users`/`invitations` carry — owned by `007-tenant-isolation-tests-and-rls.md`, which this feature does not pull forward | Adding one ad hoc RLS policy here, ahead of that item's shared cross-tenant-denial test helper, would produce an unreviewed, untested policy inconsistent with how the rest of this schema's RLS rollout is sequenced |
| Scope permission cap (FR-003) is enforced only against the coarse `admin`/`member` role, not a real per-resource permission system | No bounded context beyond `identity-access` exists yet in the new TypeScript scaffold to define real resource-level permissions against (research.md §2) | Building a full per-resource permission registry now would be speculative — no consuming context exists to validate it against, and this codebase's own conventions (`CLAUDE.md`) explicitly favor deferring abstractions with no current caller. Leaving the cap unenforced entirely was also rejected — it directly contradicts this feature's own `/speckit-clarify` answer. |
