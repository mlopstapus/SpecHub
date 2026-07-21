---
epic: 001-typescript-refactor-foundation
feature: 005-docker-compose-dev-environment
status: open
dependencies: []
---

# Docker Compose Dev Environment

Update `docker-compose.yaml` so local development (and self-hosted Free-tier deployment) runs the new unified Next.js app plus Postgres, replacing the current three-service layout (`backend`, `frontend`, `database`) with the new two-service layout (`app`, `database`). This keeps the "Rebuild: `docker compose up -d`" command in CLAUDE.md accurate throughout the refactor rather than only at the very end.

## Requirements

- [ ] `docker-compose.yaml` updated to build and run the unified app from `001-nextjs-app-scaffolding`'s scaffold
- [ ] Postgres service configuration carries forward from the current `database/` setup (custom init image, per README)
- [ ] Environment variables needed for local dev (DB connection string, JWT secret, entitlement bypass for self-host) documented in an updated `.env.example`
- [ ] `docker compose up -d` boots a working local environment: app reachable, connected to Postgres, migrations runnable

## Acceptance Criteria

- [ ] `docker compose up -d` from a clean checkout results in the app running and reachable on the expected port
- [ ] CLAUDE.md's "Rebuild" command entry stays accurate with no edits needed beyond this feature
- [ ] Old `backend/Dockerfile` and `frontend/Dockerfile` removed once the unified app's Dockerfile replaces both

## Open Questions

- Timing: does this land immediately after `001-nextjs-app-scaffolding` (so local dev works throughout the rest of the refactor) or wait until more of the app is functional? Recommend immediately — an always-runnable `docker compose up -d` is worth more than deferring it.

## Dependencies

- `001-nextjs-app-scaffolding.md`
- `002-drizzle-shared-db-kernel.md`

## Technical Notes

Per the architecture's "keep both deployment targets" decision, this only covers Docker Compose — the Helm chart update is a separate concern, tracked once `007-distribution` makes the app actually deployable end-to-end (Helm chart update isn't blocking for local dev, so it's deferred rather than included here).
