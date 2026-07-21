---
epic: 001-typescript-refactor-foundation
feature: 004-ci-pipeline
status: open
dependencies: ["backlog/000-foundations/003-testing-strategy.md"]
---

# CI Pipeline

Wire lint, typecheck, and test into GitHub Actions so every PR is gated before merge, matching the current repo's existing `.github/workflows/` pattern but extended to the new TS stack. Per tenet P1, tests are the only correctness signal available (still no static type checker beyond TS itself catching type errors, not domain invariants) — CI is what makes that signal actually gate merges instead of being advisory.

## Requirements

- [ ] GitHub Actions workflow runs on every PR: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`
- [ ] Test job spins up a real Postgres instance (per `context/testing-strategy.md`'s Testcontainers-or-equivalent decision) so integration and RLS tests can run in CI, not just unit tests
- [ ] Module-boundary lint rule (`003-module-boundary-lint-enforcement`) runs as part of the lint step
- [ ] Build step (`pnpm build`) runs and must succeed before merge
- [ ] Docker image build step, producing the same image used for both self-hosted distribution and the AWS SaaS deploy (per PDR-006's single-repo model)
- [ ] Workflow status is a required check on the `main` branch

## Acceptance Criteria

- [ ] A PR with a failing test is blocked from merging
- [ ] A PR with a lint violation (including a module-boundary violation) is blocked from merging
- [ ] A PR with a passing empty test suite (at this epic's stage, before any BC has real tests) merges cleanly
- [ ] CI run completes in a reasonable time budget for a solo maintainer's iteration loop (target: under 5 minutes for the full pipeline at this stage)

## Open Questions

- Does the Docker image build run on every PR (slower, catches build breaks early) or only on merge to `main` (faster PR feedback)? Lean toward PR-time given the image is also what self-hosters pull.

## Dependencies

- `backlog/000-foundations/003-testing-strategy.md`
- `002-drizzle-shared-db-kernel.md` (CI's Postgres test setup depends on the DB kernel existing)

## Technical Notes

This pipeline is what the old `.github/workflows/helm-publish.yml` gets replaced/extended by — confirm whether Helm chart publishing (still needed per the architecture's "keep both deployment targets" decision) stays a separate workflow or gets folded into this one.
