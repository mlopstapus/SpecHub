CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "billing";
--> statement-breakpoint
CREATE SCHEMA "distribution";
--> statement-breakpoint
CREATE SCHEMA "governance";
--> statement-breakpoint
CREATE SCHEMA "identity_access";
--> statement-breakpoint
CREATE SCHEMA "prompt_registry";
--> statement-breakpoint
CREATE SCHEMA "workflow";
--> statement-breakpoint
-- Dedicated least-privileged runtime application role (FR-010). Postgres
-- row-level security does not apply to a schema-owning role by default, so
-- every bounded context's runtime queries MUST go through this role instead
-- of whatever role ran this migration (which owns the schemas above).
--
-- Idempotent: in a managed environment where this role is already
-- provisioned out-of-band (e.g. via Terraform), this block is a no-op and
-- only the GRANT/ALTER DEFAULT PRIVILEGES statements below take effect.
-- The placeholder password is only ever reachable in a fresh local/test
-- Postgres instance — a managed environment's real password is set by its
-- own IaC, not by this migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'spechub_app') THEN
    CREATE ROLE spechub_app LOGIN PASSWORD 'changeme_in_production';
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA identity_access, governance, prompt_registry, workflow, billing, audit, distribution TO spechub_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA identity_access, governance, prompt_registry, workflow, billing, audit, distribution
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO spechub_app;
