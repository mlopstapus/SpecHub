# Implementation Plan: Docker Compose Dev Environment

**Branch**: `005-docker-compose-dev-environment` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-docker-compose-dev-environment/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Replace `docker-compose.yaml`'s current three-service layout (`spechub`/legacy backend, `frontend`, `postgres`/database) with a two-service layout (`app`, `database`): the `app` service builds from the root `Dockerfile` added in `004-ci-pipeline` (the new unified Next.js scaffold) instead of `legacy/backend/Dockerfile`/`legacy/frontend/Dockerfile`, and the `database` service drops the legacy-schema init SQL (`database/init/001_schema.sql` targets the old Python/Alembic schema, not the new Drizzle-based one — resolved in `/speckit-clarify`) while keeping the Dockerfile's OpenShift-compatible container hardening. `docker compose up -d` becomes reachable/DB-connected again with zero manual steps, and the legacy Dockerfiles are deleted.

## Technical Context

**Language/Version**: N/A application code changes — this is a Docker Compose/Dockerfile/config feature. Root app is TypeScript 5.9/Node.js ≥24 (unchanged, per `004-ci-pipeline`'s existing root `Dockerfile`).

**Primary Dependencies**: Docker Compose (existing), the root `Dockerfile` (already exists, from `004-ci-pipeline`), `database/Dockerfile` (existing, `postgres:16-alpine`-based), `drizzle-kit migrate` (existing `pnpm db:migrate` script, `002-drizzle-shared-db-kernel`)

**Storage**: PostgreSQL 16 (`database/Dockerfile`, unchanged base image). Schema ownership moves entirely to Drizzle migrations (`src/shared/db/schemas.ts` + `drizzle/migrations/`) — the compose-provisioned database starts empty, no bundled SQL init file.

**Testing**: No new automated test suite — this feature's own tests are the `quickstart.md` validation scenarios (boot the stack from a clean checkout, confirm reachability/DB connectivity/migration success), the same "the artifact under test is a config file, not application code" pattern `004-ci-pipeline` used for its workflow YAML.

**Target Platform**: Local developer machines (Docker Compose) and the self-hosted Free-tier deployment target that also runs via Compose, per CLAUDE.md.

**Project Type**: Infrastructure/config feature — touches `docker-compose.yaml`, `database/init/`, and deletes `legacy/backend/Dockerfile`/`legacy/frontend/Dockerfile`; touches no application source under `src/`.

**Performance Goals**: `docker compose up -d` → reachable, DB-connected app in under 2 minutes on a clean checkout (SC-001).

**Constraints**: Zero manual steps beyond `docker compose up -d` (plus the separate, expected `pnpm db:migrate` step) per SC-003; must not require `.env` to be filled in for `docker compose up -d` itself to work (compose supplies its own internal values, mirroring the existing pattern — see research.md Decision 4); CLAUDE.md's "Rebuild" table row must stay accurate with no edit (FR-009).

**Scale/Scope**: One compose file edit, one Dockerfile-adjacent directory edit (`database/init/`), two file deletions (legacy Dockerfiles), plus doc-accuracy fixes to README.md's now-stale banner sentence and CLAUDE.md's now-stale "still only builds/runs legacy" notes (research.md Decision 6). Solo-maintainer repo, no matrix/scale concerns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Assessment |
|---|---|---|
| I. Test-First Development `[P1]` | No | N/A — no backend domain logic added. This feature's verification is the quickstart.md boot/connect/migrate scenario, not a red-green Vitest cycle. |
| II. Domain-Driven Bounded Contexts `[D1]` | No | N/A — no bounded-context code touched. |
| III. Domain Invariants in Domain Layer `[D2]` | No | N/A — no business rule introduced. |
| IV. Multi-Tenant Isolation `[M1-M3]` | No, deliberately deferred | No bounded context has real tenant-scoped tables yet (`src/shared/db/schemas.ts` defines only the seven namespace-level Postgres schemas). Introducing genuine app-role/owner-role privilege separation now, before any RLS-protected table exists to enforce it against, would be speculative infrastructure with nothing to test it against — correctly scoped to whichever future item first adds an RLS-protected table (research.md Decision 3). |
| V. Secure by Default `[S1-S3]` | Yes | Per `/speckit-analyze` finding C1: `docker-compose.yaml` is also the self-host deployment mechanism (CLAUDE.md: "Rebuild (self-hosted stack)"), not local-dev-only, so the pre-existing hardcoded Postgres credential (`spechub`/`spechub`) was genuinely in tension with Principle VI. Remediated during `as-security-scan`: `POSTGRES_USER`/`PASSWORD`/`DB` now use `${VAR:-default}` interpolation, so a self-host operator can set a real credential via a shell env var or `.env` with zero compose-file edit, while local dev keeps its zero-config default (research.md Decision 4). Not a full fix (nothing forces an operator to override it) — a fail-on-default enforcement mechanism remains a distinct future item. No raw secret is logged. |
| VI. Auditable & Compliant `[C1-C2]` | No | N/A — a local dev/self-host compose boot is not a mutation or cross-tenant-sensitive read path. |
| VII. Feature-Gated by Entitlement `[G1]` | No | N/A — a Docker Compose file is deployment tooling, not a product feature/route/tool with a Free-vs-Paid dimension. |

No violations. Nothing required in Complexity Tracking.

**Post-design re-check** (after Phase 1): Phase 1 design didn't introduce any new principle-relevant surface beyond what Technical Context already scoped (compose healthcheck/`depends_on` wiring and a `database/init/.gitkeep` are config-only). No gate re-opens; still no violations.

## Project Structure

### Documentation (this feature)

```text
specs/005-docker-compose-dev-environment/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command) — the compose service interface contract
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
docker-compose.yaml           # MODIFIED — two services (app, database) replacing three (spechub, frontend, postgres)
database/
  Dockerfile                  # UNCHANGED — OpenShift-hardening behavior carries forward as-is
  init/
    001_schema.sql             # DELETED — targeted the legacy Python/Alembic schema, not Drizzle's
    .gitkeep                   # NEW — keeps the (now-empty) init/ directory in git for the Dockerfile's COPY
legacy/backend/Dockerfile      # DELETED — replaced by the root Dockerfile
legacy/frontend/Dockerfile     # DELETED — replaced by the root Dockerfile
README.md                      # MODIFIED — banner sentence no longer claims compose runs the legacy split stack
CLAUDE.md                      # MODIFIED — stale "docker compose up -d still only builds/runs legacy" notes corrected
```

**Structure Decision**: No `src/` changes. This feature is entirely Docker/Compose/doc-accuracy work at the repository root and in `database/`, plus deleting the two now-superseded legacy Dockerfiles — consistent with the backlog item's own scope (it depends only on `001-nextjs-app-scaffolding`'s existing root `Dockerfile` and `002-drizzle-shared-db-kernel`'s existing migration tooling, both already built).

## Testing Strategy

No new Vitest suite — there is no application logic to unit test. Verification is the `quickstart.md` scenario: from a clean checkout, run `docker compose up -d`, confirm the app responds on its documented port, confirm `pnpm db:migrate` succeeds against the compose-provisioned Postgres, then tear down and repeat once more to confirm no state leaks between runs (mirrors `004-ci-pipeline`'s own "the artifact under test is a config file" testing approach).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.
