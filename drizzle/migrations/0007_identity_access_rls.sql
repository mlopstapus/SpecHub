-- Row-level security for every identity_access table (011-tenant-isolation-rls),
-- per context/database-conventions.md's session-variable RLS pattern (tenets
-- M1/M2/M3). Two roles get different policies on the same five tables:
--
--   skillcanon_app  (existing, 0000_create_schemas.sql) — the ordinary
--     runtime connection. Restricted to the caller's own organization via
--     current_setting('app.current_org_id') (set by withTenantContext).
--
--   skillcanon_auth (new, this migration) — used only by identity-access
--     flows that must resolve an identity or bootstrap a tenant *before* any
--     organization context exists (login by email, session auth by JWT
--     subject, API-key auth by hash, invitation acceptance by token, and
--     organization/team/admin bootstrap, including the self-hosted
--     single-org guard's cross-org count). Scoped to identity_access only —
--     no DELETE, no access to any other schema — narrower than the
--     migration/owner role, which bypasses RLS entirely as the table owner.
--
-- Idempotent role creation, matching skillcanon_app's existing pattern: in a
-- managed environment where this role is already provisioned out-of-band,
-- this block is a no-op and only the GRANT/POLICY statements below take
-- effect.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'skillcanon_auth') THEN
    CREATE ROLE skillcanon_auth LOGIN PASSWORD 'changeme_in_production';
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA identity_access TO skillcanon_auth;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity_access TO skillcanon_auth;
--> statement-breakpoint

-- login() and acceptInvitation() write an audit event (via audit-compliance's
-- record()) in the same transaction as their pre-auth reads — audit.audit_events
-- has no RLS/tenant scoping in this feature's scope, so a plain grant (no
-- policy needed) is sufficient. SELECT is required alongside INSERT because
-- record()'s insert() uses `.returning()`, and Postgres requires SELECT
-- privilege on any column an INSERT ... RETURNING clause returns. No
-- UPDATE/DELETE — this role never modifies an existing audit row.
GRANT USAGE ON SCHEMA audit TO skillcanon_auth;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit.audit_events TO skillcanon_auth;
--> statement-breakpoint

-- organizations: the tenant root itself carries no organization_id column
-- (PDR-003) — the policy matches the row's own id against the session
-- variable instead (this feature's FR-002, superseding the "no RLS policy"
-- exception 005-org-tenant-model's data-model.md originally documented).
ALTER TABLE identity_access.organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON identity_access.organizations
  TO skillcanon_app
  USING (id = current_setting('app.current_org_id')::uuid);
--> statement-breakpoint
CREATE POLICY auth_role_bypass ON identity_access.organizations
  TO skillcanon_auth
  USING (true)
  WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE identity_access.teams ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON identity_access.teams
  TO skillcanon_app
  USING (organization_id = current_setting('app.current_org_id')::uuid);
--> statement-breakpoint
CREATE POLICY auth_role_bypass ON identity_access.teams
  TO skillcanon_auth
  USING (true)
  WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE identity_access.users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON identity_access.users
  TO skillcanon_app
  USING (organization_id = current_setting('app.current_org_id')::uuid);
--> statement-breakpoint
CREATE POLICY auth_role_bypass ON identity_access.users
  TO skillcanon_auth
  USING (true)
  WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE identity_access.invitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON identity_access.invitations
  TO skillcanon_app
  USING (organization_id = current_setting('app.current_org_id')::uuid);
--> statement-breakpoint
CREATE POLICY auth_role_bypass ON identity_access.invitations
  TO skillcanon_auth
  USING (true)
  WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE identity_access.api_keys ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON identity_access.api_keys
  TO skillcanon_app
  USING (organization_id = current_setting('app.current_org_id')::uuid);
--> statement-breakpoint
CREATE POLICY auth_role_bypass ON identity_access.api_keys
  TO skillcanon_auth
  USING (true)
  WITH CHECK (true);
