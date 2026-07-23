# Data Model: Docker Compose Dev Environment

This feature has no runtime data model — no database tables, no domain entities. The "model" here is the **compose stack's own structural entities**, matching spec.md's requirements.

## Entity: Compose Service

- **Represents**: One of the two services defined in `docker-compose.yaml` after this change — `app` or `database`.
- **Attributes**: build context (Dockerfile path), exposed port, environment values, health check, `depends_on` relationship.
- **Lifecycle**: created on `docker compose up -d`; torn down on `docker compose down`. Replaces the three services (`skillcanon`, `frontend`, `postgres`) that exist today — those service names disappear from the file entirely (FR-001).
- **Relationships**: `app` depends on `database` reaching a healthy state (Decision 5, research.md) before it is considered started.

## Entity: Database Init Directory

- **Represents**: `database/init/`, copied into the Postgres container's `/docker-entrypoint-initdb.d/` by `database/Dockerfile`.
- **Attributes**: contents run once, only on a fresh (empty) data volume's first boot.
- **State change**: previously contained `001_schema.sql` (legacy Alembic-derived schema); now empty except a `.gitkeep` (Decision 2, research.md) — schema creation is owned entirely by Drizzle migrations instead.

## Entity: Environment Variable Set

- **Represents**: The two independent places local configuration lives — `docker-compose.yaml`'s own `environment:` blocks (compose-internal, service-hostname-based, no `.env` dependency) and the root `.env.example` (the interface for running the app outside Docker via `pnpm dev`/`pnpm db:migrate`).
- **Attributes**: `DATABASE_URL`, `MIGRATION_DATABASE_URL` — both already documented in `.env.example` from `002-drizzle-shared-db-kernel`; no new variable is introduced by this feature (Decision 4, research.md; `/speckit-clarify` Q2).
- **Not modeled here**: a JWT secret and a self-host entitlement-bypass variable — explicitly deferred to whichever future epic implements auth/billing (spec.md Clarifications).
