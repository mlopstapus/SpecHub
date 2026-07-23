---

description: "Task list for Docker Compose Dev Environment"
---

# Tasks: Docker Compose Dev Environment

**Input**: Design documents from `/specs/005-docker-compose-dev-environment/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/compose-services.md, quickstart.md

**Tests**: Not a Vitest suite — per plan.md's Testing Strategy, this feature's correctness criterion is behavioral (a real `docker compose up -d` boot), verified via quickstart.md's scenarios. Each user story phase below includes the quickstart scenario(s) that validate it.

**Organization**: Tasks are grouped by user story (US1–US3 from spec.md), in priority order. Most tasks touch a small number of shared files (`docker-compose.yaml`, `database/init/`), so real parallelism is limited — as in `004-ci-pipeline`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: Which user story this task belongs to

## Path Conventions

Single project at repository root (`docker-compose.yaml`, `database/`, `legacy/backend/`, `legacy/frontend/`) per `context/repo-structure.md` and plan.md's Structure Decision.

---

## Phase 1: Setup

**Purpose**: Baseline before any change

- [X] T001 Record baseline: run `docker compose up -d` against the current three-service layout, confirm it boots as CLAUDE.md describes today, then `docker compose down -v` to return to a clean state before making changes — baseline already confirmed: `docker compose ps -a` showed all three legacy services (`skillcanon`, `frontend`, `postgres`) running healthy for 22h prior to this change

**Checkpoint**: Baseline recorded

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Retire the legacy schema init script before any service reshuffling is validated against it

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Delete `database/init/001_schema.sql` (targets the legacy Python/Alembic schema, not the new Drizzle-based one) and add `database/init/.gitkeep` so the now-empty directory still exists for `database/Dockerfile`'s `COPY init/ /docker-entrypoint-initdb.d/` step (research.md Decision 2). `database/Dockerfile` itself is unchanged — confirm its OpenShift-hardening steps still apply cleanly to an empty `init/` directory.

**Checkpoint**: Database container no longer bundles legacy schema; Drizzle migrations own schema creation going forward

---

## Phase 3: User Story 1 - One-command local environment (Priority: P1) 🎯 MVP

**Goal**: `docker compose up -d` boots exactly two services (`app`, `database`), the app is reachable on its documented port, and it connects to Postgres with no manual step.

**Independent Test**: From a clean checkout, run `docker compose up -d` and confirm both services start, `app` is reachable, and the legacy Dockerfiles no longer exist (quickstart.md Scenarios 1 and 4).

### Implementation for User Story 1

- [X] T003 [US1] Rewrite `docker-compose.yaml`: replace the `skillcanon`/`frontend`/`postgres` services with `app`/`database` per `contracts/compose-services.md` — `app` builds from `.` (root `Dockerfile`), maps `3000:3000`, sets `DATABASE_URL`/`MIGRATION_DATABASE_URL` as compose-internal values pointing at the `database` service hostname (research.md Decision 4), and `depends_on: database: condition: service_healthy`; `database` builds from `./database` (unchanged), keeps `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` as today, maps `5432:5432`, and adds a `healthcheck:` using `pg_isready` (research.md Decision 5). Depends on T002. **Amended during `as-security-scan`** (finishing pipeline): `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` and the connection strings built from them now use `${VAR:-skillcanon}`-style Compose interpolation instead of a bare hardcoded literal, so a self-host operator can override the credential via a shell env var or `.env` with no compose-file edit, while local dev keeps the zero-config `skillcanon`/`skillcanon` default. Verified both the default boot and an overridden boot (`POSTGRES_USER=customuser POSTGRES_PASSWORD=strongpw123 POSTGRES_DB=customdb docker compose up -d`) work end-to-end.
- [X] T004 [US1] [P] Delete `legacy/backend/Dockerfile` and `legacy/frontend/Dockerfile` (FR-008) — the unified app's root `Dockerfile` now covers both. Depends on T003 (compose no longer references either path).
- [X] T005 [US1] Follow quickstart.md Scenario 1: `docker compose up -d`, confirm `docker compose ps` shows exactly `app` and `database` (both healthy/running), and `curl -sf http://localhost:3000/` returns 200. Depends on T003, T004. **Verified**: both services up, `database` healthy, `curl` returns `200`.
- [X] T005b [US1] Verify FR-005/Acceptance Scenario 2 directly (not just app reachability): since `src/app/page.tsx` makes no DB call (research.md Decision 7), run an ad hoc connectivity check from inside the `app` container. Depends on T005. **Corrected during implementation**: the originally-planned `require('postgres')(...)` check fails — the runtime image is Next.js's `.next/standalone` output, which only bundles traced dependencies, and no code path imports `postgres`, so it isn't present in the running container (`ls /app/node_modules` shows only `next`/`react`/`react-dom`). Used a TCP-level check via Node's built-in `net` module against the app's actual `DATABASE_URL` instead: `docker compose exec app node -e "const u=new URL(process.env.DATABASE_URL); require('net').createConnection({host:u.hostname,port:u.port||5432}, ()=>{console.log('OK');process.exit(0)}).on('error', e=>{console.error(e);process.exit(1)})"` — printed `OK`.
- [X] T006 [US1] Follow quickstart.md Scenario 4: `docker compose down -v` then `docker compose up -d` again, confirm an identical clean result — proving the `database/init/` change (T002) doesn't leave the container in a different first-boot state. Depends on T005b.

**Checkpoint**: User Story 1 is fully functional and independently testable — `docker compose up -d` boots the unified two-service stack from a clean checkout.

---

## Phase 4: User Story 2 - Documented local environment configuration (Priority: P1)

**Goal**: `.env.example` accurately documents every variable the app and database services actually consume today, with no `.env` required for `docker compose up -d` itself.

**Independent Test**: Copy `.env.example` to `.env`, fill in the values, and confirm both the Docker path and the non-Docker (`pnpm dev`) path work with no missing/undocumented variable (quickstart.md Scenario 2).

### Implementation for User Story 2

- [X] T007 [US2] Verify the root `.env.example` (from `002-drizzle-shared-db-kernel`) still accurately documents `DATABASE_URL`/`MIGRATION_DATABASE_URL` for the non-Docker path, matching `src/shared/db/client.ts`'s `getConnectionString()` expectations — no JWT secret or self-host entitlement-bypass variable is added (spec.md Clarifications, `/speckit-clarify` Q2). Edit only if an inaccuracy is found; expected outcome is no change needed. Depends on T003.
- [X] T008 [US2] Follow quickstart.md Scenario 2: `docker compose down -v` with no `.env` file present, then `docker compose up -d`, confirm it boots successfully with zero `.env` setup (research.md Decision 4). Separately, `cp .env.example .env`, fill in the compose-exposed values (`postgresql://skillcanon:skillcanon@localhost:5432/skillcanon` for both variables), run `pnpm dev` outside Docker, and confirm no missing-env error. Depends on T003, T007.

**Checkpoint**: User Stories 1 and 2 both verified — the stack boots with zero config, and the documented non-Docker path also works.

---

## Phase 5: User Story 3 - Migrations run against the local stack (Priority: P2)

**Goal**: `pnpm db:migrate` applies successfully against the Postgres instance provisioned by `docker compose up -d`.

**Independent Test**: With the stack running, run the migration command and confirm the schema is applied with no additional setup (quickstart.md Scenario 3).

### Implementation for User Story 3

- [X] T009 [US3] Follow quickstart.md Scenario 3: with the stack running (T005), run `MIGRATION_DATABASE_URL=postgresql://skillcanon:skillcanon@localhost:5432/skillcanon pnpm db:migrate` from the host, confirm it applies successfully, then `docker compose exec database psql -U skillcanon -d skillcanon -c "\dn"` and confirm the seven bounded-context schemas exist (`identity_access`, `governance`, `prompt_registry`, `workflow`, `billing`, `audit`, `distribution`) with no legacy tables (e.g. no `teams`/`users` from the old schema). Depends on T002, T003, T005.

**Checkpoint**: All three user stories independently verified — the stack boots, is fully documented, and migrations apply cleanly against it.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T010 [P] Update README.md's banner sentence ("`docker compose up -d` still builds and runs them [legacy backend/frontend]") to reflect that `docker compose up -d` now builds and runs the unified scaffold app + Postgres (research.md Decision 6).
- [X] T011 [P] Update CLAUDE.md's two now-stale Notes bullets: the one asserting `docker compose up -d` "still builds and runs the legacy app... it has not yet been repointed at the new scaffold," and the `as-finish` Docker-rebuild-skip note that assumes compose "still only builds/runs legacy/backend, legacy/frontend, and Postgres" (research.md Decision 6).
- [X] T012 Confirm CLAUDE.md's "Rebuild" table row (`docker compose up -d`) needs no edit — the command text itself is unchanged, only what it runs (FR-009). Verification only; no file change expected.
- [X] T013 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` at the repo root to confirm no regressions from this feature's changes (none are expected — no `src/` files touched). Depends on T003, T004.
- [X] T015 Time `docker compose up -d` from invocation to the first successful `curl -sf http://localhost:3000/` on a clean checkout (`docker compose down -v` first) and confirm it completes in under 2 minutes (SC-001). Depends on T006. **Verified**: 7 seconds with images already built (T005 separately confirmed a from-scratch `--build` run also completes well within budget, ~25s for the app image build).
- [X] T016 Verify SC-004's "fully retired" claim repo-wide: `grep -rn "legacy/backend/Dockerfile\|legacy/frontend/Dockerfile" . --exclude-dir=.git` returns no remaining references outside git history. Depends on T004, T010, T011. **Verified**: all remaining matches are historical/explanatory prose (correctly past-tense) in CLAUDE.md, `specs/004-ci-pipeline/`, and this feature's own `specs/005-.../` — none are live build/config references. **Found one additional stale reference during the sweep** (not from this exact grep, but from a broader check): `.claude/anchorstack/project.md` still described `docker compose up -d` as running the legacy backend/frontend — fixed alongside T011.
- [X] T014 Update `backlog/001-typescript-refactor-foundation/005-docker-compose-dev-environment.md`'s Requirements/Acceptance Criteria checkboxes to reflect what's actually done, then move the file to `backlog/001-typescript-refactor-foundation/archive/` per CLAUDE.md's archival convention. Update `EPIC.md` to check off item 005 and flip the epic's `Status` to done, since this is the epic's last remaining feature. Depends on T005, T005b, T006, T008, T009, T010, T011, T013, T015, T016. **Done**: backlog item's `status` flipped to `done`, all Requirements/Acceptance Criteria checked (with an inline note on Requirement 2's/3's resolved scope), moved to `archive/005-docker-compose-dev-environment.md`. `EPIC.md`'s item 005 checked off and its own `Status` flipped to `done` (epic's last remaining feature). Also fixed items 001–004's links in `EPIC.md`, which pointed at the pre-archive top-level path even after those files were already moved to `archive/` in earlier sessions — a pre-existing broken-link defect, fixed while touching this file.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — no dependency on US2/US3
- **User Story 2 (Phase 4)**: Depends on Foundational and on `docker-compose.yaml`'s new shape existing (T003) — conceptually independent (env docs already exist; this phase mostly verifies)
- **User Story 3 (Phase 5)**: Depends on Foundational and on T003/T005 (a running two-service stack to migrate against)
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- `docker-compose.yaml` (T003) is the shared file every other task in Phases 3–5 depends on directly or indirectly
- T004 (deleting legacy Dockerfiles) can run in parallel with T003 in principle, but is sequenced after it here since T003 is what stops referencing those paths
- Quickstart validation tasks (T005, T006, T008, T009) are sequential within their phase (each boots/tears down the same stack)

### Parallel Opportunities

- T004 and T003 touch different files and could be done in parallel by different people
- T010 and T011 touch different files (README.md, CLAUDE.md) and can run in parallel
- Real parallelism is otherwise limited — most tasks concentrate on `docker-compose.yaml`, a single shared file

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 — this alone delivers the core value (unified two-service `docker compose up -d`)
4. **STOP and VALIDATE**: quickstart.md Scenarios 1 and 4
5. Continue to US2–US3 to close the remaining backlog-item requirements (env documentation, migrations)

### Incremental Delivery

1. Setup + Foundational → legacy schema init retired
2. User Story 1 → two-service stack boots and is reachable (MVP)
3. User Story 2 → zero-`.env` boot and documented non-Docker path confirmed
4. User Story 3 → migrations apply cleanly against the compose-provisioned database
5. Polish → doc-accuracy sweep, regression check, backlog item archived, epic marked done

---

## Notes

- [P] tasks = different files, no blocking dependency
- Commit after each task or logical group
- No branch-protection-style irreversible action exists in this task list (unlike `004-ci-pipeline`'s T010) — everything here is version-controlled file changes plus local verification
