# Contract: Docker Compose Service Interface

**Status**: Decided (this feature)

This is the interface other things depend on: a developer running `docker compose up -d`, and any future backlog item (e.g. Helm chart alignment, deployment tooling) that assumes a particular service name, port, or env var shape.

## Services

| Service | Replaces | Build context | Exposed port | Depends on |
|---|---|---|---|---|
| `app` | `skillcanon` (legacy backend) + `frontend` | `.` (repository-root `Dockerfile`, from `004-ci-pipeline`) | `3000` (host) → `3000` (container) | `database` (`condition: service_healthy`) |
| `database` | `postgres` | `./database` (`database/Dockerfile`, unchanged) | `5432` (host) → `5432` (container) | — |

## Removed service names

`skillcanon`, `frontend`, `postgres` no longer exist in `docker-compose.yaml` after this feature. Anything (scripts, docs, a developer's muscle memory) referencing `docker compose ... skillcanon|frontend|postgres` by name needs to switch to `app`/`database`.

## Environment values (compose-internal, not read from `.env`)

| Variable | Service | Value shape | Notes |
|---|---|---|---|
| `DATABASE_URL` | `app` | `postgresql://<user>:<pass>@database:5432/skillcanon` | Same value serves both runtime and migration use inside the container network — no role separation yet (research.md Decision 3) |
| `MIGRATION_DATABASE_URL` | `app` (available for `pnpm db:migrate` run against the compose stack) | Same connection string as `DATABASE_URL` for now | See Decision 3 — will diverge once real role separation lands |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `database` | Unchanged from today (`skillcanon`/`skillcanon`/`skillcanon`) | |

## Database init directory

`database/init/` is copied into the container's `/docker-entrypoint-initdb.d/`. As of this feature it contains no SQL — schema creation is exclusively Drizzle's responsibility (`pnpm db:migrate`, run by a developer after `docker compose up -d`, per FR-007). Anything relying on the database being pre-populated with tables at first boot (as the legacy `001_schema.sql` did) must instead run migrations.

## What this contract does NOT cover

- The Helm chart (`charts/skillcanon/`) — unchanged, deferred to a future distribution-focused backlog item per spec.md's Assumptions.
- Any production/SaaS deployment env var wiring — this contract describes only the local Compose interface.
