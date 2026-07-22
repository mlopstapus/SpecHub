---
epic: 001-typescript-refactor-foundation
feature: 004-ci-pipeline
status: open
dependencies: ["backlog/000-foundations/003-testing-strategy.md"]
---

# CI Pipeline

Wire lint, typecheck, and test into GitHub Actions so every PR is gated before merge, matching the current repo's existing `.github/workflows/` pattern but extended to the new TS stack. Per tenet P1, tests are the only correctness signal available (still no static type checker beyond TS itself catching type errors, not domain invariants) — CI is what makes that signal actually gate merges instead of being advisory.

## Requirements

- [x] GitHub Actions workflow runs on every PR: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (`.github/workflows/ci.yml`)
- [x] Test job spins up a real Postgres instance (per `context/testing-strategy.md`'s Testcontainers-or-equivalent decision) so integration and RLS tests can run in CI, not just unit tests (no CI-level `services:` block needed — the existing `startTestDb()`/Testcontainers helper self-provisions per test file; `ci.yml`'s `test` job only needs the runner's Docker daemon)
- [x] Module-boundary lint rule (`003-module-boundary-lint-enforcement`) runs as part of the lint step (the `lint` job runs `pnpm lint`, which already includes it — no separate step)
- [x] Build step (`pnpm build`) runs and must succeed before merge (`build` job, gated by `ci-gate`)
- [x] Docker image build step, producing the same image used for both self-hosted distribution and the AWS SaaS deploy (per PDR-006's single-repo model) — root `Dockerfile` authored, `docker-build` job builds it on every PR (no push), `docker-publish.yml` pushes to `ghcr.io/mlopstapus/spechub` on merge to `main`; verified locally that the built image runs and serves HTTP 200
- [ ] Workflow status is a required check on the `main` branch — `ci-gate` job exists and is designed as the single required check (see `specs/004-ci-pipeline/contracts/required-check.md`), but branch protection has not yet been configured against a live GitHub Actions run

## Acceptance Criteria

- [ ] A PR with a failing test is blocked from merging — unverified until this feature's own PR is open and branch protection is configured
- [ ] A PR with a lint violation (including a module-boundary violation) is blocked from merging — unverified, same reason
- [ ] A PR with a passing empty test suite (at this epic's stage, before any BC has real tests) merges cleanly — unverified, same reason
- [ ] CI run completes in a reasonable time budget for a solo maintainer's iteration loop (target: under 5 minutes for the full pipeline at this stage) — unverified until a real workflow run exists

## Open Questions

- ~~Does the Docker image build run on every PR (slower, catches build breaks early) or only on merge to `main` (faster PR feedback)? Lean toward PR-time given the image is also what self-hosters pull.~~ **Resolved** via `/speckit-clarify` (see `specs/004-ci-pipeline/spec.md` Clarifications, 2026-07-21): build on every PR (no push), push to the registry only on merge to `main`.

## Dependencies

- `backlog/000-foundations/003-testing-strategy.md`
- `002-drizzle-shared-db-kernel.md` (CI's Postgres test setup depends on the DB kernel existing)

## Technical Notes

This pipeline is what the old `.github/workflows/helm-publish.yml` gets replaced/extended by — confirm whether Helm chart publishing (still needed per the architecture's "keep both deployment targets" decision) stays a separate workflow or gets folded into this one.
