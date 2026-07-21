# Project Config

## Git
provider: github
base_branch: main

## Stack
Monorepo: Python/FastAPI backend (`backend/`) — SQLAlchemy async + asyncpg, Alembic migrations, MCP server (sh-server), uv for dependency management, ruff for lint, pytest for tests. Next.js 14 + TypeScript frontend (`frontend/`) — Radix UI, Tailwind CSS. Postgres database (`database/`) with custom init image. Docker Compose for local dev; Helm chart (`charts/spechub/`) for Kubernetes deploy, published to GHCR as an OCI artifact.

Note: backend is expected to be refactored to TypeScript in a future initiative — re-run as-setup-project after that migration to update stack/commands.

## Compliance
hipaa: false
soc2: true
gdpr: false
pci: false

Note: NIST (likely NIST 800-53 / CSF alignment) also called out as in-scope alongside SOC2. Not a dedicated as-finish check yet — flag NIST-relevant controls (access control, audit logging, encryption) manually until a dedicated check exists.

## Rebuild
docker compose up -d

## Type check
cd frontend && npx tsc --noEmit

Note: backend has no type checker configured (no mypy/pyright). Skipped for now per user — backend is slated for a future rewrite in TypeScript, at which point tsc coverage will extend to it.

## Lint
cd backend && ruff check . ; cd frontend && npm run lint

## Test
cd backend && python -m pytest tests/ -v

Note: frontend has no test script configured.
