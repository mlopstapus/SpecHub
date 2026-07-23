# Quickstart: Validating the CI Pipeline

This guide proves the feature works end-to-end once implemented. It does not include implementation code — see `research.md` for tool/config decisions and `data-model.md` for the workflow's structural entities; implementation itself belongs to `tasks.md`.

## Prerequisites

- `.github/workflows/ci.yml`, the root `Dockerfile`/`.dockerignore`, and `ci-gate` have been added (tasks.md).
- `main`'s branch protection has `ci-gate` configured as a required status check (per `contracts/required-check.md`).
- Working tree on branch `004-ci-pipeline`, pushed to a remote the GitHub Actions runner can see.

## Scenario 1 — Failing test blocks merge (User Story 1)

1. On a throwaway branch, add a Vitest test file asserting something false (e.g. `expect(1).toBe(2)`).
2. Open a PR against `main`.
3. **Expected**: the `test` job fails, `ci-gate` fails, the PR shows a failing required check and cannot be merged (merge button disabled/blocked).
4. Close the PR / delete the branch.

## Scenario 2 — Lint violation, including a module-boundary violation, blocks merge (User Story 1 & 2)

1. On a throwaway branch, add a file under one bounded context importing another bounded context's internal path directly (see `specs/003-module-boundary-lint-enforcement/quickstart.md` Scenario 1 for the exact pattern).
2. Open a PR against `main`.
3. **Expected**: the `lint` job fails (module-boundary rule fires), `ci-gate` fails, PR is blocked.
4. Close the PR / delete the branch.

## Scenario 3 — Type error blocks merge (User Story 1)

1. On a throwaway branch, introduce a type error (e.g. assign a `string` to a variable typed `number`).
2. Open a PR against `main`.
3. **Expected**: the `typecheck` job fails, `ci-gate` fails, PR is blocked.
4. Close the PR / delete the branch.

## Scenario 4 — Build failure blocks merge (User Story 1)

1. On a throwaway branch, introduce a change that fails `next build` (e.g. an invalid import that only surfaces at build time).
2. Open a PR against `main`.
3. **Expected**: the `build` job fails, `ci-gate` fails, PR is blocked.
4. Close the PR / delete the branch.

## Scenario 5 — Passing empty test suite merges cleanly (User Story 1, Acceptance Scenario 5)

1. Open a PR with a trivial, passing change (e.g. a comment or Markdown edit) against `main`, at this epic's stage where no bounded context yet has real tests.
2. **Expected**: `lint`, `typecheck`, `test` (passes trivially — zero test failures), `build`, and `docker-build` all succeed; `ci-gate` succeeds; PR merges cleanly with no manual override.

## Scenario 6 — Integration/RLS test runs against a real, ephemeral Postgres instance (User Story 3)

1. Confirm (or temporarily add) a test that calls `startTestDb()` (e.g. `src/shared/db/tenant-context.test.ts`).
2. Open a PR touching that test file, or re-run the `test` job on an existing PR.
3. **Expected**: the `test` job's logs show a Testcontainers-managed Postgres container starting and the test connecting to it successfully — no external database connection string is configured in the workflow YAML itself.
4. Push a second commit to the same PR and re-run.
5. **Expected**: a fresh container is provisioned for the new run (no state leaks from the previous run's container, which was already torn down).

## Scenario 7 — Docker image build breakage blocks merge, without requiring a registry push (User Story 4)

1. On a throwaway branch, introduce a change breaking the Docker build (e.g. a bad instruction in `Dockerfile`, or removing a file it `COPY`s).
2. Open a PR against `main`.
3. **Expected**: the `docker-build` job fails, `ci-gate` fails, PR is blocked. No registry login/push is attempted at any point in this run (confirm in the job logs — `docker-build` only runs `docker build`, never `docker push`).
4. Revert the breaking change; confirm `docker-build` now succeeds and produces an image (still not pushed).
5. Close the PR / delete the branch.

## Scenario 8 — Image publish happens only on merge to `main` (Clarifications, FR-011)

1. Merge any passing PR into `main`.
2. **Expected**: a separate `docker-publish` job/workflow run triggers on the merge commit, builds the image again, and pushes it to `ghcr.io/mlopstapus/skillcanon` tagged with the merge commit SHA. Confirm no `docker-publish` run exists for the PR's own (pre-merge) commits — only for the post-merge push to `main`.

## Scenario 9 — Full pipeline completes within budget (SC-003)

1. Time any of the above passing-PR runs from workflow trigger to `ci-gate`'s final status.
2. **Expected**: under 5 minutes, at this epic's current stage (near-empty test suite, minimal application code).
