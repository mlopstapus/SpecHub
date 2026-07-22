---

description: "Task list for CI Pipeline"
---

# Tasks: CI Pipeline

**Input**: Design documents from `/specs/004-ci-pipeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/required-check.md, quickstart.md

**Tests**: Not a Vitest suite — per plan.md's Testing Strategy, this feature's correctness criterion is behavioral (real PRs against the workflow), verified via quickstart.md's scenarios. Each user story phase below includes the quickstart scenario(s) that validate it as its "test" step.

**Organization**: Tasks are grouped by user story (US1–US4 from spec.md), in priority order. Nearly every task edits one of two shared files (`.github/workflows/ci.yml`, `.github/workflows/docker-publish.yml`), so — as in `003-module-boundary-lint-enforcement` — most tasks are sequential rather than `[P]`; real parallelism here is limited.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: Which user story this task belongs to

## Path Conventions

Single project at repository root (`.github/workflows/`, `Dockerfile`, `next.config.ts`) per `context/repo-structure.md` and plan.md's Structure Decision.

---

## Phase 1: Setup

**Purpose**: Baseline before any change

- [X] T001 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` at the repo root to record a clean baseline before any change

**Checkpoint**: Baseline recorded

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The workflow file skeleton every user story's job gets added to

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Create `.github/workflows/ci.yml` with `name: CI`, triggered `on: pull_request: branches: [main]`, and a `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` block (so a superseding push cancels an in-flight run for the same PR) — no jobs yet beyond this skeleton
- [X] T003 In `ci.yml`, document (as a YAML comment above the `jobs:` key) the standard per-job step sequence every job that needs pnpm/Node (`lint`, `typecheck`, `test`, `build` — not `docker-build`, which builds entirely inside the Docker build context) repeats: `actions/checkout@v4`, `pnpm/action-setup@v4` (version from `packageManager` in `package.json`), `actions/setup-node@v4` (node-version from `engines.node` in `package.json`, `cache: pnpm`), then `pnpm install --frozen-lockfile` — per research.md's Technical Context, no `services:` block is included in this standard sequence (FR-004 is satisfied by Testcontainers self-provisioning, not a CI-level service; see research.md Decision 2)

**Checkpoint**: `ci.yml` skeleton exists with trigger and documented step convention; ready for job tasks

---

## Phase 3: User Story 1 - Merge is blocked on broken code (Priority: P1) 🎯 MVP

**Goal**: A PR with a failing test, lint violation, type error, or build failure is blocked from merging; a passing PR (even with today's near-empty test suite) merges cleanly.

**Independent Test**: Open throwaway PRs each violating one gate (test/lint/typecheck/build) and confirm each is blocked; open a trivial passing PR and confirm it merges cleanly (quickstart.md Scenarios 1, 3, 4, 5).

### Implementation for User Story 1

- [X] T004 [US1] In `ci.yml`, add a `lint` job using the standard step sequence (T003) plus a final step running `pnpm lint`. Depends on T002, T003.
- [X] T005 [US1] In `ci.yml`, add a `typecheck` job using the standard step sequence plus a final step running `pnpm typecheck`. Depends on T002, T003.
- [X] T006 [US1] In `ci.yml`, add a `test` job using the standard step sequence plus a final step running `pnpm test` — no `services:` Postgres block (research.md Decision 2); `ubuntu-latest`'s pre-installed Docker daemon is sufficient for the existing `startTestDb()`/Testcontainers-backed tests to self-provision. Depends on T002, T003.
- [X] T007 [US1] In `ci.yml`, add a `build` job using the standard step sequence plus a final step running `pnpm build`. Depends on T002, T003.
- [X] T008 [US1] In `ci.yml`, add a `ci-gate` job with `needs: [lint, typecheck, test, build]` (docker-build is added to this list in T024, US4) and a single no-op step (e.g. `run: echo "ci-gate passed"`) — GitHub already fails this job if any dependency fails, so no additional logic is needed. Depends on T004–T007.
- [ ] T009 [US1] Push the `004-ci-pipeline` branch (this feature's own implementation branch, not a throwaway one — unlike the quickstart-validation tasks below) and open a real PR against `main` so `ci-gate` (and its dependency jobs) appear at least once in the repository's check-run history — a prerequisite for T010, since GitHub can only mark a check required after it has appeared on a run.
- [ ] T010 [US1] **Requires explicit user confirmation before executing** (a shared repository-settings change, not reversible via this feature's own files): configure `main`'s branch protection to require the `ci-gate` status check, per `contracts/required-check.md` — via GitHub repository Settings → Branches, or `gh api repos/:owner/:repo/branches/main/protection` with `required_status_checks.contexts: ["ci-gate"]`. Depends on T009.
- [ ] T011 [US1] Follow quickstart.md Scenario 1 (failing test): on a throwaway branch, add a Vitest assertion that's always false, open a PR, confirm `test` and `ci-gate` fail and the PR shows as blocked; then close the PR and delete the branch. Depends on T010.
- [ ] T012 [US1] Follow quickstart.md Scenario 3 (type error): on a throwaway branch, assign a `string` to a `number`-typed variable, open a PR, confirm `typecheck` and `ci-gate` fail and the PR is blocked; then close the PR and delete the branch. Depends on T010.
- [ ] T013 [US1] Follow quickstart.md Scenario 4 (build failure): on a throwaway branch, introduce a change that fails `next build` only (not lint/typecheck), open a PR, confirm `build` and `ci-gate` fail and the PR is blocked; then close the PR and delete the branch. Depends on T010.
- [ ] T014 [US1] Also validate a generic (non-boundary) lint violation, e.g. an unused variable: on a throwaway branch, add one, open a PR, confirm `lint` and `ci-gate` fail and the PR is blocked (the module-boundary-specific case is validated separately in US2, Phase 4); then close the PR and delete the branch. Depends on T010.
- [ ] T015 [US1] Follow quickstart.md Scenario 5: open a PR with a trivial passing change (e.g. a Markdown edit), confirm `lint`, `typecheck`, `test` (passes trivially — no real tests exist yet at this epic's stage), and `build` all succeed, `ci-gate` succeeds, and the PR merges cleanly with no manual override; also confirm the check appeared on the PR automatically with no manual trigger needed (SC-004). Depends on T010.

**Checkpoint**: User Story 1 is fully functional and independently testable — every gated failure mode blocks merge, and a clean PR merges without friction.

---

## Phase 4: User Story 2 - Module-boundary violations are caught automatically (Priority: P1)

**Goal**: The `003-module-boundary-lint-enforcement` rule (already part of `pnpm lint` locally) fails the same `lint` CI job as any other lint issue — no separate step or configuration.

**Independent Test**: Add an import crossing a bounded-context boundary, open a PR, confirm the same `lint` job (from Phase 3) fails on it (quickstart.md Scenario 2).

### Implementation for User Story 2

> No new `ci.yml` configuration is needed — the `lint` job (T004) already runs `pnpm lint`, which already includes the boundary rule from `003-module-boundary-lint-enforcement`. This phase is validation-only, and is the concrete moment that closes that feature's own previously-unmet CI-wiring acceptance criterion.

- [ ] T016 [US2] Follow quickstart.md Scenario 2 (reusing the exact violation pattern from `specs/003-module-boundary-lint-enforcement/quickstart.md` Scenario 1): on a throwaway branch, add a file under one bounded context importing another's internal (non-barrel) path, open a PR, confirm `lint` and `ci-gate` fail with the boundary-violation message (naming the violated context's `CONTRACT.md`); then close the PR and delete the branch. Depends on T010.
- [ ] T017 [US2] Update `backlog/001-typescript-refactor-foundation/archive/003-module-boundary-lint-enforcement.md`'s third Acceptance Criterion ("Rule is wired into the CI pipeline... not just available locally") to checked, now that T016 has proven it — this criterion was explicitly left unmet when that item was archived, pending this feature. Depends on T016.

**Checkpoint**: User Stories 1 and 2 both verified — the core correctness gate and its boundary-enforcement case both work, and `003`'s deferred criterion is now closed.

---

## Phase 5: User Story 3 - Integration and RLS tests run against a real database (Priority: P2)

**Goal**: The `test` job's existing Testcontainers-backed integration/RLS tests (e.g. `src/shared/db/tenant-context.test.ts`) run successfully against a real, ephemeral, per-run-isolated Postgres instance inside CI, with no CI-level database service configured.

**Independent Test**: Trigger the `test` job on a PR touching a Testcontainers-backed test file and confirm it connects to a real Postgres instance, isolated per run (quickstart.md Scenario 6).

### Implementation for User Story 3

> No new job is added — the `test` job (T006) is already configured with no `services:` block, per research.md Decision 2. This phase confirms that decision holds against the real GitHub-hosted runner, since `ubuntu-latest`'s Docker availability is an external assumption worth verifying directly rather than only trusting documentation.

- [ ] T018 [US3] Follow quickstart.md Scenario 6: open a PR touching `src/shared/db/tenant-context.test.ts` (or any other test calling `startTestDb()`), inspect the `test` job's logs, and confirm a Testcontainers-managed Postgres container starts and the test connects successfully, with no external database connection string configured anywhere in `ci.yml`. Depends on T010.
- [ ] T019 [US3] Push a second commit to the same PR from T018, re-run the `test` job, and confirm the logs show a newly-provisioned container (not a reused one) — proving per-run isolation (spec.md User Story 3, Acceptance Scenario 2). Then close the PR and delete the branch. Depends on T018.

**Checkpoint**: User Stories 1–3 all verified — the pipeline both gates and correctly exercises real database behavior for tenant-isolation-sensitive tests.

---

## Phase 6: User Story 4 - A deployable Docker image is produced and verified (Priority: P2)

**Goal**: Every PR builds (but never pushes) a Docker image from a new root `Dockerfile`; the image is pushed to the registry only on merge to `main`; a broken image build blocks merge just like any other gated failure.

**Independent Test**: Open a PR that breaks the Docker build and confirm it's blocked without any registry push being attempted; merge a passing PR and confirm the separate merge-time workflow builds and pushes the image (quickstart.md Scenarios 7 and 8).

### Implementation for User Story 4

- [X] T020 [US4] [P] Add `output: "standalone"` to `next.config.ts`'s `NextConfig` object, so the production build emits a minimal, self-contained server bundle suitable for a slim runtime image (research.md Decision 4). Depends on T001.
- [X] T021 [US4] [P] Create root `.dockerignore` excluding `legacy/`, `node_modules/`, `.git/`, `.next/`, and other build/dev artifacts not needed inside the image build context. Depends on T001. (A `.dockerignore` already existed for the legacy stack — extended it with `legacy` (broadened from `legacy/frontend` only), `.pnpm-store`, `*.tsbuildinfo`, `.env*` rather than replacing it.)
- [X] T022 [US4] Author a multi-stage root `Dockerfile`: a `deps` stage installing dependencies via pnpm with a frozen lockfile, a `build` stage running `pnpm build` (producing the `output: "standalone"` bundle from T020), and a slim runtime stage copying only `.next/standalone`, `.next/static`, and `public/` and running the standalone server. Depends on T020, T021. Verified locally: `docker build .` succeeds and `docker run` serves HTTP 200 on `/`. (`public/` doesn't exist yet in this scaffold; the build stage runs `mkdir -p public` before `pnpm build` so the runtime stage's `COPY --from=build /app/public` doesn't fail.)
- [X] T023 [US4] In `ci.yml`, add a `docker-build` job using the standard step sequence (checkout only — no pnpm/node setup needed since the build happens entirely inside the Docker build context) plus a step running `docker build .` (build only — no `docker login`, no `docker push`, no registry reference at all). Depends on T022.
- [X] T024 [US4] In `ci.yml`, update the `ci-gate` job's `needs:` list (T008) to include `docker-build`. Depends on T008, T023.
- [X] T025 [US4] Create `.github/workflows/docker-publish.yml`: `name: Publish Docker Image`, triggered `on: push: branches: [main]`, with a single job that checks out the repo, logs into `ghcr.io` (using `secrets.GITHUB_TOKEN`, matching `helm-publish.yml`'s existing pattern), runs `docker build .` again, tags the image `ghcr.io/mlopstapus/spechub:${{ github.sha }}` (and `:latest`), and pushes both tags. This workflow is intentionally separate from `ci.yml` and is never referenced by `ci-gate` or branch protection (research.md Decision 3 — it cannot gate the PR that produced the commit it runs on). Depends on T022.
- [ ] T026 [US4] Follow quickstart.md Scenario 7: on a throwaway branch, break the Docker build (e.g. an invalid `Dockerfile` instruction or a `COPY` of a removed file), open a PR, confirm `docker-build` and `ci-gate` fail and the PR is blocked, and confirm (via job logs) no `docker login`/`docker push` was attempted at any point; revert the change and confirm `docker-build` now succeeds; then close the PR and delete the branch. Depends on T024.
- [ ] T027 [US4] Follow quickstart.md Scenario 8: merge a passing PR into `main`, confirm `docker-publish.yml` triggers on the merge commit and successfully pushes an image tagged with the merge commit SHA to `ghcr.io/mlopstapus/spechub`, and confirm no `docker-publish` run exists for any of the PR's own pre-merge commits. Depends on T025, T026.
- [ ] T028 [US4] Verify SC-005 directly (not just that the image builds/pushes): `docker run` the image published in T027 locally, mapping its port, and confirm the Next.js server starts and responds to a basic request (e.g. `curl localhost:<port>/`). Repointing `docker-compose.yaml` or the Helm chart's `values.yaml` at this new image is explicitly out of scope for this feature (per CLAUDE.md, `docker-compose.yaml` still targets `legacy/backend`/`legacy/frontend`) — this task only proves the artifact itself is a working, runnable image, which is the part of SC-005 this feature can actually verify. Depends on T027.

**Checkpoint**: All four user stories independently verified — the full pipeline gates on code correctness and image buildability, and image publishing is correctly deferred to merge time only.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T029 Follow quickstart.md Scenario 9: time a passing PR's `ci-gate` run from trigger to final status and confirm it completes in under 5 minutes (SC-003/FR-009); if not, identify the slowest job (most likely `docker-build` or `test`) and note follow-up optimization as a separate concern, not silently absorbed into this feature. Depends on T015, T018, T026.
- [X] T030 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` across the full repo one more time to confirm no regressions from `next.config.ts`'s `output: "standalone"` change, comparing against the T001 baseline. Depends on T020.
- [X] T031 Confirm `.github/workflows/helm-publish.yml` is byte-for-byte unchanged (FR-010 — Helm publishing stays a separate, untouched workflow per research.md Decision 5). Confirmed via `git diff`/`git status` — zero changes.
- [ ] T032 Update `backlog/001-typescript-refactor-foundation/004-ci-pipeline.md`'s Requirements/Acceptance Criteria checkboxes to reflect what's actually done, resolve its "Open Questions" entry (Docker image build timing) with a pointer to this feature's Clarifications session, then move the file to `backlog/001-typescript-refactor-foundation/archive/` per CLAUDE.md's archival convention, since all stated acceptance criteria are met. Depends on T029, T030, T031.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — no dependency on US2/US3/US4
- **User Story 2 (Phase 4)**: Depends on Foundational and on the `lint` job (T004) and branch protection (T010) existing to have anything to verify against — conceptually independent (proves no new work is needed, closes `003`'s deferred criterion)
- **User Story 3 (Phase 5)**: Depends on Foundational and on the `test` job (T006) and branch protection (T010) existing — conceptually independent (proves no new work is needed)
- **User Story 4 (Phase 6)**: Depends on Foundational; its `next.config.ts`/`Dockerfile` tasks (T020–T022) have no dependency on US1–US3, but `docker-build`'s addition to `ci-gate` (T024) depends on `ci-gate` already existing (T008, US1)
- **Polish (Phase 7)**: Depends on all four user stories being complete

### Within Each User Story

- `ci.yml` changes (T002–T008, T023, T024) are strictly sequential — same file
- Branch protection (T010) blocks every quickstart validation task in every phase (T011–T016, T018–T019, T026–T028), since "PR is blocked from merging" isn't literally observable without it
- `Dockerfile`/`next.config.ts`/`.dockerignore` (T020–T022) can proceed in parallel with each other and with Phase 3–5 work, since they don't touch `ci.yml` until T023

### Parallel Opportunities

- T020 and T021 touch different files with no interdependency and can run in parallel
- T020–T022 (Dockerfile-side work) can proceed in parallel with Phase 3's `ci.yml` job tasks, up until T023 needs both to exist
- Real parallelism is otherwise limited: most tasks concentrate in `ci.yml`, a single shared file, so most are sequential by nature rather than by artificial ordering

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 — this alone delivers the core correctness gate (lint/typecheck/test/build blocking merge)
4. **STOP and VALIDATE**: quickstart.md Scenarios 1, 3, 4, 5
5. Continue to US2–US4 to close the remaining backlog-item requirements (boundary enforcement, real-DB testing, deployable image)

### Incremental Delivery

1. Setup + Foundational → workflow skeleton ready
2. User Story 1 → core gate works, branch protection configured (MVP)
3. User Story 2 → boundary-specific lint case confirmed, closes `003`'s deferred criterion
4. User Story 3 → Testcontainers/RLS testing confirmed working in real CI
5. User Story 4 → deployable image built on every PR, published only on merge
6. Polish → timing check, full regression check, backlog item archived

---

## Notes

- [P] tasks = different files, no blocking dependency
- T010 (branch protection) is called out for explicit user confirmation before execution — it's a shared repository-settings change outside this feature's own version-controlled files, and the closest thing to an irreversible action in this task list
- Delete every temporary branch/PR created for a manual quickstart scenario before moving to the next task
- Commit after each task or logical group

## Implementation Status (2026-07-21)

All file-based/local tasks are complete and verified locally: T001–T008, T020–T025, T030–T031. `.github/workflows/ci.yml`, `.github/workflows/docker-publish.yml`, the root `Dockerfile`/`.dockerignore`, and `next.config.ts`'s `output: "standalone"` all exist; `pnpm lint`/`typecheck`/`test`/`build` and a local `docker build`/`docker run` (HTTP 200 on `/`) all pass.

**Deferred by explicit user choice**, pending this feature's own PR being pushed and reviewed: T009–T019, T026–T029, T032. These require pushing this branch and opening the real PR (T009 — expected to happen via `as-finish`'s `as-commit`/`as-pr` steps rather than as a separate manual action), configuring `main`'s branch protection (T010), and running/observing live GitHub Actions PR runs (throwaway validation PRs, the merge-triggered registry push, and the timing check). The backlog item (`backlog/001-typescript-refactor-foundation/004-ci-pipeline.md`) has been updated to reflect exactly this split — Requirements that are concretely built are checked; the required-check wiring and all Acceptance Criteria remain unchecked and the item stays `status: open`, unarchived, until live validation happens.
