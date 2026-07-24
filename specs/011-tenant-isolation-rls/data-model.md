# Data Model: Tenant Isolation Tests & RLS

This feature adds no new tables and no new columns. Its "data model" is entirely row-level security policy shape plus two role definitions layered onto the five existing `identity_access` tables from prior features.

## Tables affected

| Table | Existing scope column | Tenant policy predicate (`skillcanon_app`) | Auth-role policy (`skillcanon_auth`) |
|---|---|---|---|
| `identity_access.organizations` | none (`id` *is* the tenant root, PDR-003) | `id = current_setting('app.current_org_id')::uuid` | `USING (true) WITH CHECK (true)` |
| `identity_access.teams` | `organization_id` | `organization_id = current_setting('app.current_org_id')::uuid` | `USING (true) WITH CHECK (true)` |
| `identity_access.users` | `organization_id` | `organization_id = current_setting('app.current_org_id')::uuid` | `USING (true) WITH CHECK (true)` |
| `identity_access.invitations` | `organization_id` | `organization_id = current_setting('app.current_org_id')::uuid` | `USING (true) WITH CHECK (true)` |
| `identity_access.api_keys` | `organization_id` | `organization_id = current_setting('app.current_org_id')::uuid` | `USING (true) WITH CHECK (true)` |

Every policy is scoped with an explicit `TO <role>` clause — never left to default to `PUBLIC` — so the two roles' policies coexist per-table without interfering (research.md §1–2).

## Migration shape (new file: `drizzle/migrations/0007_identity_access_rls.sql`)

Hand-written raw SQL (not `drizzle-kit generate`-produced — RLS policies have no Drizzle schema-builder representation, matching how `0000_create_schemas.sql`'s role-creation `DO` block is also hand-written). Per table:

```sql
ALTER TABLE identity_access.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON identity_access.<table>
  TO skillcanon_app
  USING (<predicate from table above>);

CREATE POLICY auth_role_bypass ON identity_access.<table>
  TO skillcanon_auth
  USING (true)
  WITH CHECK (true);
```

Plus, once per migration (idempotent `DO $$ ... $$` block matching `skillcanon_app`'s existing creation pattern in `0000_create_schemas.sql`):

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'skillcanon_auth') THEN
    CREATE ROLE skillcanon_auth LOGIN PASSWORD 'changeme_in_production';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA identity_access TO skillcanon_auth;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity_access TO skillcanon_auth;

-- login() and acceptInvitation() also audit-log within the same transaction
-- as their pre-auth reads; audit.audit_events has no RLS in this feature's
-- scope, so a plain grant (no policy) is sufficient. SELECT is required
-- alongside INSERT because record()'s insert() uses `.returning()`, and
-- Postgres requires SELECT privilege on any RETURNING column.
GRANT USAGE ON SCHEMA audit TO skillcanon_auth;
GRANT SELECT, INSERT ON audit.audit_events TO skillcanon_auth;
```

No `DELETE` grant for `skillcanon_auth`, and no `UPDATE` on `audit.audit_events` — nothing in this bounded context's current flows needs those via this role (research.md §2). Otherwise, no grant on any other schema — narrower than the migration/owner role by design.

## Role summary

| Role | Used by | Schema reach | RLS behavior |
|---|---|---|---|
| `skillcanon_app` (existing) | The ordinary runtime app connection (`shared/db/client.ts`'s `db`) — every authenticated, org-scoped operation | All 7 schemas (existing grant) | Subject to `tenant_isolation` policies on these 5 tables |
| `skillcanon_auth` (new) | `login`, `authenticateSession`, `authenticateApiKey`, `acceptInvitation`, `createOrganization`/`bootstrapOrganization` — every flow that must resolve an identity or bootstrap a tenant *before* an org context exists (research.md §2) | `identity_access` only | Unrestricted (via `auth_role_bypass`) on these 5 tables; no access elsewhere |
| Migration/owner role (existing) | `drizzle-kit push`/migrate only | All 7 schemas, DDL | Bypasses RLS entirely (table owner) |

## Application-layer contract changes

| Function | Before | After | Why |
|---|---|---|---|
| `getUser(db, userId)` | Unscoped `findById` always | `getUser(db, userId, organizationId?)` — scoped via `findByOrgAndId` when `organizationId` given; unscoped fallback retained only for `authenticateSession`'s pre-auth call | Closes the M1 gap for every other consumer without breaking the one legitimate no-context caller (research.md §3) |
| `getTeamChain(db, teamId)` | Unscoped `findById`, walked with no check | `getTeamChain(db, organizationId, teamId)` — mandatory param; starting lookup via new `teams-repo.findByOrgAndId` | No legitimate unscoped consumer exists (Governance always has its own org context) |
| `getOrganization(db, organizationId)` | Unscoped `findById` | **Unchanged** | No second identity to compare against; RLS alone is the correct, sufficient backstop here (research.md §3) |
| `teams-repo` | No `findByOrgAndId` | Adds `findByOrgAndId(tx, organizationId, id)`, mirroring `users-repo`/`invitations-repo`/`api-keys-repo` | Needed by `getTeamChain`'s fix; closes a real inconsistency (every other repo in this BC already had this helper) |
| `updateTeam(tx, teamId, fields)` | No `organizationId` param, no scoping check at all — an unconditional `UPDATE ... WHERE id = teamId` | `updateTeam(tx, organizationId, teamId, fields)` — scoped via the new `teams-repo.findByOrgAndId`, throws for a cross-org or nonexistent `teamId` | Found during the final audit pass (research.md §3a): `CONTRACT.md` already claimed this enforcement existed; it didn't. Without this fix, RLS alone would have turned a cross-org update into a *silent no-op* rather than a thrown denial, breaking this BC's established "denial is observable" convention |

`login`, `authenticateSession`, `authenticateApiKey`, `acceptInvitation`, `createOrganization`, `bootstrapOrganization`, `provisionTeamAndAdmin` — **no signature or body changes**. Only the DB connection their (future) caller passes in changes, from the ordinary `db` to `authDb` (research.md §2).

## New shared infrastructure

- `shared/db/client.ts`: new lazily-initialized `authDb` export, connected via `AUTH_DATABASE_URL` (same placeholder/missing-value guard as `db`/`getConnectionString`).
- `shared/db/test-helpers.ts`: `TestDb` gains an `authDb: ReturnType<typeof createRoleClient>` field, connected as `skillcanon_auth` against the same ephemeral container.
- `shared/testing/tenant-isolation.ts` (new module): `assertCrossTenantDenied` (research.md §5).

## Key Entities (from spec.md, restated with the concrete shape above)

- **Organization**: tenant root; RLS policy predicate matches its own `id`, not a foreign column.
- **Team, User, Invitation, API Key**: each carries `organization_id`; RLS predicate matches it directly.
- **`skillcanon_app` / `skillcanon_auth`**: the two Postgres roles whose differing policy scopes are what make tenant isolation (for the former) and legitimate no-context bootstrap/credential-resolution (for the latter) both possible on the same tables.
- **Cross-tenant-denial test helper**: not a data entity — a shared test utility (`assertCrossTenantDenied`), documented above and in research.md §5.
