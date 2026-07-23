# Research: CI Pipeline

## Decision 1: One workflow file, one gating job, N constituent jobs

**Decision**: Author a single `.github/workflows/ci.yml` with parallel jobs (`lint`, `typecheck`, `test`, `build`, `docker-build`) plus one final `ci-gate` job that `needs: [lint, typecheck, test, build, docker-build]` and simply exits 0 if all its dependencies succeeded. `ci-gate` — not the individual jobs — is the single check configured as required in `main`'s branch protection (FR-008).

**Rationale**:
- Running `lint`/`typecheck`/`test`/`build`/`docker-build` as parallel jobs (rather than sequential steps in one job) is what makes the under-5-minute budget (FR-009/SC-003) realistic — a Next.js Docker image build and a Testcontainers-backed test run are each independently a meaningful fraction of that budget, and running them serially would very likely blow it.
- A single `ci-gate` summary job means branch protection is configured once, against a job name that never changes even if constituent jobs are added/renamed/split later — avoiding a re-configuration step (a manual GitHub Settings action) every time the pipeline's internals evolve. This is the standard GitHub Actions pattern for "one required check over an N-job matrix."
- GitHub Actions branch protection can only require named checks that exist on the PR's most recent run; requiring each of the 5 jobs individually works too, but the summary-job pattern is more resilient to future changes and is a single point to document in `contracts/required-check.md`.

**Alternatives considered**:
- Requiring each job individually as its own branch-protection check: rejected — more brittle (every future job addition/removal is a branch-protection edit) for no behavioral difference at this scale.
- One monolithic job running every step sequentially: rejected — cannot realistically hit the 5-minute budget once the Docker build is included, and a single failure early (e.g. lint) would still leave the runner paying for later steps' setup cost only to fail anyway (or require careful `continue-on-error` bookkeeping to avoid that).

## Decision 2: No CI-level Postgres service — tests self-provision via existing Testcontainers helper

**Decision**: The `test` job does **not** declare a `services: postgres: ...` block. It only needs `ubuntu-latest`'s pre-installed Docker daemon, which the existing `startTestDb()` helper (`src/shared/db/test-helpers.ts`) already uses via `@testcontainers/postgresql` to spin up one ephemeral, isolated Postgres container per test file that needs one.

**Rationale**:
- FR-004 ("a real, ephemeral Postgres database instance for the test job, isolated per workflow run") is fully satisfied by the test suite's *existing* behavior — `context/testing-strategy.md`'s Testcontainers decision was made at the test-authoring level (epic 000/002), not the CI-job level. Re-declaring a `services:` Postgres in the workflow would be redundant infrastructure that the tests don't consume, and would not, by itself, give per-test-file isolation the way Testcontainers already does (a single shared `services:` Postgres would need per-test-file schema/database naming to avoid cross-test interference, which is exactly what Testcontainers already handles by giving each `startTestDb()` call its own container).
- The only CI-specific requirement is that Docker-in-Docker (or Docker-alongside-runner) works on the chosen runner. `ubuntu-latest` GitHub-hosted runners ship Docker Engine pre-installed and support this out of the box; no `services:` or `docker:dind` setup is needed for Testcontainers to work.

**Alternatives considered**:
- A `services: postgres:` block with a single long-lived database for the whole job: rejected — duplicates what Testcontainers already does per-test-file, and reintroduces the cross-test isolation problem `context/testing-strategy.md` explicitly chose Testcontainers to avoid.

## Decision 3: Docker image build/push split across PR vs. merge-to-main triggers

**Decision**: `docker-build` (part of the required `ci-gate`) runs on every PR and only runs `docker build` locally on the runner — no `docker push`, no registry login. A second, separate job/workflow (`docker-publish`, triggered `on: push: branches: [main]`) rebuilds and pushes the image to GHCR (`ghcr.io/mlopstapus/skillcanon`, matching the existing `helm-publish.yml` registry/org) once a PR has actually merged. `docker-publish` is **not** part of the required check (it can't be — it only runs after merge, so it would never gate the PR it corresponds to).

**Rationale**: This is exactly the Clarifications-session decision (`spec.md` FR-007/FR-011) — build-only on PR, push only on merge — chosen specifically so no registry credential needs to be reachable from a PR-time run (including fork PRs), while still catching image-build breakage at PR time per the backlog item's own stated lean.
- Registry choice (GHCR over ECR): the repo already publishes the Helm chart to `ghcr.io/mlopstapus/charts` (`helm-publish.yml`), so GHCR is the existing, already-authenticated registry pattern for this repo (`secrets.GITHUB_TOKEN` is sufficient, no new credential to provision). `context/deployment.md`'s CI/CD section separately describes pushing to ECR as part of a *later*, broader AWS deploy pipeline (staging/production ECS deploy, `drizzle-kit migrate` against staging) — that pipeline is explicitly out of scope for this backlog item (004-ci-pipeline only requires the image to *build* and be *the same artifact* for both distribution paths, not that this feature also wires the AWS deploy itself). Whether AWS ECS eventually pulls directly from GHCR or a copy is mirrored into ECR is left as a decision for whatever future backlog item implements `context/deployment.md`'s AWS CI/CD step 2 — noted here so it isn't silently forgotten, not resolved by this feature.
- Rebuilding (rather than re-using the PR-time build artifact) on merge is simpler than plumbing a build artifact between two separate workflow runs (the PR's `docker-build` job and the post-merge `docker-publish` job are different workflow runs, potentially far apart in time/commits if the PR sat for a while) and keeps `docker-publish` a fully independent, minimal job.

**Alternatives considered**:
- Push on every PR, tagged by PR/commit SHA: rejected per Clarifications — expands the security surface (registry credentials reachable from fork PRs) for a benefit (testing the exact pre-merge artifact) the backlog item didn't ask for.
- Skip building entirely on PR, build+push only on merge: rejected per Clarifications and the backlog item's own stated lean — image-build breakage would only surface after merge, too late for a solo-maintainer's fast-iteration goal.

## Decision 4: A root-level `Dockerfile` must be authored as part of this feature — none exists yet for the new scaffold

**Decision**: Author a new root `Dockerfile` (multi-stage: pnpm install → `next build` → minimal runtime image) and `.dockerignore`, since neither currently exists for the new root-level Next.js/TypeScript scaffold. `database/Dockerfile`, `legacy/backend/Dockerfile`, and `legacy/frontend/Dockerfile` exist but are for the old split stack and Postgres image respectively — none of them build the new scaffold.

**Rationale**: FR-006 ("the system MUST build a Docker image... the same image used for both self-hosted distribution and the AWS SaaS deployment") is meaningless without something to build. This wasn't previously called out as a dependency in the backlog item's own Dependencies section, so it's flagged here explicitly as new scope this feature must cover (a `tasks.md` task), rather than assumed pre-existing.
- A standard multi-stage Next.js Docker build (deps stage with frozen pnpm lockfile install, build stage running `pnpm build`, slim runtime stage copying `.next/standalone` output if `next.config` enables `output: "standalone"`, otherwise the full `.next` + `node_modules`) is the reasonable default per Next.js's own documented Docker deployment pattern — no project-specific deviation is needed at this stage since the scaffold has no business logic yet (per CLAUDE.md, "empty bounded-context barrels").
- Enabling `output: "standalone"` in `next.config` may be needed for a minimal runtime image; if the scaffold's `next.config` doesn't already set this, this feature's tasks.md includes adding it, since it's a one-line, low-risk config addition directly required to make FR-006 achievable with a reasonably small image.

**Alternatives considered**: Deferring the `Dockerfile`'s authorship to a later epic item and having this feature's `docker-build`/`docker-publish` jobs be no-ops/placeholders until then — rejected: FR-006 and User Story 4 are explicit, stated requirements of this backlog item; silently deferring them would leave the feature incomplete against its own spec.

## Decision 5: Helm chart publishing stays a separate workflow (FR-010's resolved either/or)

**Decision**: `helm-publish.yml` is left completely unmodified. `ci.yml` is an entirely new, additional workflow file.

**Rationale**: FR-010 explicitly allows either "folded in" or "left separate," and per spec.md's Assumptions this was resolved toward "leave separate" — it triggers on a different condition (`paths: charts/skillcanon/**`, not every PR) and packages/pushes a Helm chart, not an application image; folding it in would add branching complexity to `ci.yml` for a workflow whose trigger condition and payload are both unrelated to the code-correctness gate this feature is building. No stated acceptance criterion depends on merging them.

**Alternatives considered**: Folding Helm publishing into `ci.yml` as an additional conditional job — rejected as unnecessary complexity per the above; nothing in spec.md requires it.
