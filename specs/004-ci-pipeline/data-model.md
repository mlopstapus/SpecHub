# Data Model: CI Pipeline

This feature has no runtime data model — no database tables, no domain entities. The "model" here is the **workflow's own structural entities**: the jobs, triggers, and artifacts the pipeline is built from, matching spec.md's Key Entities section.

## Entity: Workflow Run

- **Represents**: One execution of `.github/workflows/ci.yml` against one PR's code state (or, for `docker-publish`, one merge commit on `main`).
- **Attributes**: trigger event (`pull_request` vs. `push` to `main`), head SHA, set of constituent job results, overall `ci-gate` outcome, duration.
- **Lifecycle**: created on PR open/synchronize (or push to `main`); terminal state is success or failure; superseded by a new run on the next push to the same PR (GitHub cancels/ignores the stale run's effect on the check, per default `concurrency` behavior — see Decision 1 in research.md for why only `ci-gate`'s outcome matters).

## Entity: Job

- **Represents**: One named unit of work inside the workflow — `lint`, `typecheck`, `test`, `build`, `docker-build` (PR-time), `docker-publish` (merge-time only), `ci-gate`.
- **Attributes**: name, trigger condition (which of `pull_request`/`push:main` it runs under), dependency edges (`needs:`), pass/fail outcome.
- **Relationships**: `ci-gate` depends on (`needs:`) `lint`, `typecheck`, `test`, `build`, `docker-build` — never on `docker-publish`, which cannot run before merge and therefore cannot gate the PR that produces it.

## Entity: Required Check

- **Represents**: The single named status (`ci-gate`) that `main`'s GitHub branch protection is configured to require.
- **Attributes**: name (`ci-gate`), enforcement scope (`main` only).
- **Not modeled as workflow YAML**: branch protection is a repository setting (GitHub UI/API), not expressible inside `ci.yml` itself — `contracts/required-check.md` documents this as the interface contract other systems (a human doing repo setup, or a future Terraform/`gh` automation) depend on.

## Entity: Ephemeral Database Instance

- **Represents**: A Testcontainers-provisioned Postgres container, one per test file that calls `startTestDb()` (existing helper, `src/shared/db/test-helpers.ts`) — not a CI-workflow-level concept at all, just the `test` job's runtime dependency (Decision 2, research.md).
- **Attributes**: none tracked by this feature — fully owned by the existing test infrastructure; this feature's only obligation is to run `test` on a runner where Docker is available.

## Entity: Docker Image Artifact

- **Represents**: The built container image, shared between the self-hosted distribution path (Docker Compose / Helm) and the AWS SaaS deployment path (per FR-006/PDR-006).
- **Attributes**: two lifecycle states — *built* (produced by every `docker-build` PR-time run, never persisted beyond the runner) and *published* (pushed to `ghcr.io/mlopstapus/spechub` only by `docker-publish`, merge-time only, tagged at minimum with the merge commit SHA).
- **Relationships**: Built from the new root `Dockerfile` (research.md Decision 4); consumed downstream by Docker Compose (local self-host) and the Helm chart's `values.yaml` image reference (not modified by this feature — wiring the Helm chart's `image:` field to the new published tag, and the AWS ECS task definition, is deployment-epic scope, not this feature's).
