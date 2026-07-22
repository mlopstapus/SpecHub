# Quickstart: Docker Compose Dev Environment

Validates spec.md's User Stories 1–3 end-to-end. Run from a clean checkout (or after `docker compose down -v` to simulate one).

## Prerequisites

- Docker and Docker Compose installed.
- `pnpm install` run at least once (for `pnpm db:migrate`, run from the host against the compose-exposed Postgres port).

## Scenario 1 — One-command local environment (US1)

```bash
docker compose up -d
docker compose ps            # expect exactly two services: app, database — both "healthy"/"running"
curl -sf http://localhost:3000/  # expect a 200 response

# FR-005/Acceptance Scenario 2: prove the app's own DATABASE_URL actually reaches Postgres
# (page.tsx makes no DB call itself — research.md Decision 7 — so this is verified ad hoc.
# Uses Node's built-in `net` module, not the `postgres` npm package: the runtime image is
# Next.js's `.next/standalone` output, which only bundles traced dependencies — since no
# code path imports `postgres`, it isn't present in the running container. A TCP-level
# connect to the exact host:port in the app's own DATABASE_URL is what's actually available.)
docker compose exec app node -e "const u=new URL(process.env.DATABASE_URL); require('net').createConnection({host:u.hostname,port:u.port||5432}, ()=>{console.log('OK');process.exit(0)}).on('error', e=>{console.error(e);process.exit(1)})"
```

Expected: both services start with no manual intervention; the app responds on `localhost:3000` (contracts/compose-services.md); the ad hoc connectivity check prints `OK`.

## Scenario 2 — No `.env` required to boot (US2)

```bash
docker compose down -v   # clean slate, no .env file present
docker compose up -d
curl -sf http://localhost:3000/
```

Expected: boots successfully with no `.env` file at all — compose supplies its own internal connection values (research.md Decision 4). Separately, confirm `.env.example` is accurate for the non-Docker path:

```bash
cp .env.example .env
# fill in DATABASE_URL / MIGRATION_DATABASE_URL with the compose-exposed values:
# postgresql://spechub:spechub@localhost:5432/spechub
pnpm dev   # outside Docker — should start with no missing-env error
```

## Scenario 3 — Migrations run against the compose stack (US3)

```bash
docker compose up -d
MIGRATION_DATABASE_URL=postgresql://spechub:spechub@localhost:5432/spechub pnpm db:migrate
```

Expected: migrations apply successfully, creating the seven bounded-context Postgres schemas (`src/shared/db/schemas.ts`) with no legacy tables present (no `001_schema.sql` ran — research.md Decision 2). Confirm with:

```bash
docker compose exec database psql -U spechub -d spechub -c "\dn"
# expect: identity_access, governance, prompt_registry, workflow, billing, audit, distribution
# (no legacy tables like "teams"/"users" from the old schema)
```

## Scenario 4 — Clean re-run, no state leaks

```bash
docker compose down -v
docker compose up -d
docker compose ps   # same two services, fresh volume
```

Expected: identical result to Scenario 1 — proves the `database/init/` change (now empty, `.gitkeep` only) doesn't leave the container in a different first-boot state.

## Teardown

```bash
docker compose down -v
```
