# Contract: `main` Branch Required Check

This feature's externally-visible interface is not an API — it's the **name and behavior of the GitHub status check** that other parts of the repository's process (a human merging a PR, a future automation script) depend on.

## Contract

- **Check name**: `ci-gate`
- **Scope**: required on the `main` branch's branch protection rules
- **Guarantee**: `ci-gate` reports success if and only if `lint`, `typecheck`, `test`, `build`, and `docker-build` (PR-time image build, no push) all succeeded for the PR's current head commit.
- **Stability promise**: `ci-gate` is the *only* job name branch protection should ever reference. Constituent job names (`lint`, `typecheck`, etc.) MAY be renamed, split, or added to in future work without requiring a branch-protection settings change, as long as `ci-gate`'s `needs:` list is updated to match.
- **Out of contract**: `docker-publish` (merge-time-only image push) is never part of `ci-gate` and is never a required check — it cannot run before merge, so it cannot gate the PR that produces it. `helm-publish.yml` is an entirely separate, pre-existing workflow with its own trigger (`paths: charts/spechub/**`) and is not part of this contract at all.

## Consumers of this contract

- **Repository branch protection settings** (GitHub UI/API) — must list `ci-gate` as a required status check on `main`. This is a one-time manual setup action (or future IaC/`gh api` automation) outside this feature's own YAML; `tasks.md` includes a task to perform (or document) this setup step.
- **Future backlog items** adding new CI-gated concerns (e.g., a new lint rule, a new test tier) should add a new job and add it to `ci-gate`'s `needs:` list, not create a second required check.
