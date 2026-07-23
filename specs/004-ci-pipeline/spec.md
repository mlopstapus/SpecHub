# Feature Specification: CI Pipeline

**Feature Branch**: `004-ci-pipeline`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "backlog/001-typescript-refactor-foundation/004-ci-pipeline.md"

## Clarifications

### Session 2026-07-21

- Q: When should the Docker image build (and any registry push) run relative to a PR vs. a merge to main? → A: Build on every PR (no push); push to the registry only on merge to main.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Merge is blocked on broken code (Priority: P1)

As the maintainer of SkillCanon, when I open a pull request against `main`, I want the repository to automatically check that the change builds, passes lint, passes type checking, and passes the test suite, so that broken code cannot land on `main` and I don't have to remember to run these checks myself before merging.

**Why this priority**: This is the core value of the feature — an automated, non-bypassable correctness gate. Per project tenet P1, tests (and now lint/build) are the only correctness signal available until a richer type/domain-invariant checker exists, so making that signal actually gate merges (rather than being advisory) is the entire point of this backlog item.

**Independent Test**: Open a PR that intentionally fails one check (e.g., a failing unit test) against a repo with this workflow installed, and confirm the PR is marked as failing and cannot be merged (assuming branch protection requires the check). This delivers value on its own even before other stories are addressed.

**Acceptance Scenarios**:

1. **Given** a PR with a failing test, **When** the workflow runs, **Then** the workflow run fails and the PR is blocked from merging.
2. **Given** a PR with a lint violation, **When** the workflow runs, **Then** the workflow run fails and the PR is blocked from merging.
3. **Given** a PR with a type error, **When** the workflow runs, **Then** the workflow run fails and the PR is blocked from merging.
4. **Given** a PR where the build step fails, **When** the workflow runs, **Then** the workflow run fails and the PR is blocked from merging.
5. **Given** a PR with a passing empty test suite (expected at this epic's stage, before any bounded context has real tests), **When** the workflow runs, **Then** the workflow run succeeds and the PR can merge cleanly.

---

### User Story 2 - Module-boundary violations are caught automatically (Priority: P1)

As the maintainer, I want the module-boundary lint rule (from `003-module-boundary-lint-enforcement`) to run as part of the same automated lint step, so that architectural boundary violations are caught before merge with the same rigor as any other lint issue, without needing a separate manual review step.

**Why this priority**: Boundary enforcement was built specifically to be enforced continuously; without CI wiring it exists only as a rule a developer can run locally and skip. This is equally foundational to the PR's core purpose, so it shares P1.

**Independent Test**: Open a PR that introduces an import violating a bounded-context boundary rule, and confirm the same lint step that catches style violations also fails on this violation.

**Acceptance Scenarios**:

1. **Given** a PR with a change that imports across a disallowed module boundary, **When** the lint step runs, **Then** the workflow run fails and the PR is blocked from merging.

---

### User Story 3 - Integration and RLS tests run against a real database (Priority: P2)

As the maintainer, I want the test job to run against a real Postgres instance (not a mock), so that integration tests and Row-Level Security (tenant isolation) tests exercise real database behavior in CI, catching issues that mocked tests would miss.

**Why this priority**: This directly extends the value of User Story 1 (tests actually gating merges) to the subset of tests that require real database semantics to be meaningful at all — particularly RLS/tenant-isolation tests, which are a compliance-relevant correctness signal. It's P2 rather than P1 because, at this epic's current stage, there are not yet real integration/RLS tests to run (per this backlog item's own "empty test suite" acceptance criterion) — the capability needs to exist and be ready, but its payoff is realized as soon as those tests land in a later epic item.

**Independent Test**: Add a temporary integration test that requires a live Postgres connection (e.g., a query against a real table), run the workflow, and confirm it passes using the CI-provisioned database rather than failing for lack of a database connection.

**Acceptance Scenarios**:

1. **Given** a test suite containing a test that requires a live Postgres connection, **When** the workflow's test job runs, **Then** the test connects successfully to a real, ephemeral Postgres instance provisioned for that run.
2. **Given** the workflow run completes, **When** the next run starts, **Then** it starts from a fresh, isolated database instance (no state leaks between runs).

---

### User Story 4 - A deployable Docker image is produced and verified (Priority: P2)

As the maintainer, I want the same pipeline to build the Docker image used for both self-hosted distribution and the AWS SaaS deployment, so that image-build breakage is caught automatically and the image that gets shipped is always one that has passed the same checks as the code.

**Why this priority**: This protects a downstream concern (deployability, distribution) rather than the immediate in-PR correctness signal of Stories 1–2, and depends on the app already building successfully, so it is sequenced after the core gating stories. It remains P2 (not P3) because a broken image build is a real ship-blocking failure mode the team wants caught at PR time, not discovered later at deploy time.

**Independent Test**: Open a PR that introduces a change breaking the Docker image build (e.g., a bad `Dockerfile` instruction) and confirm the workflow fails independently of whether the lint/typecheck/test/build steps pass.

**Acceptance Scenarios**:

1. **Given** a PR whose changes break the Docker image build, **When** the workflow's image-build step runs, **Then** the workflow run fails and the PR is blocked from merging.
2. **Given** a PR that passes all other checks, **When** the image-build step runs, **Then** it produces a single image artifact usable for both self-hosted distribution and the AWS SaaS deployment target.

---

### Edge Cases

- What happens when the workflow itself is misconfigured (e.g., a required check is renamed) such that `main`'s branch protection no longer recognizes it? The PR would appear to merge without any status shown — this is treated as a configuration error to guard against by keeping the required check name stable, not a runtime behavior this feature must detect.
- How does the system handle a PR that only touches documentation or non-code files (e.g., a Markdown file in `backlog/`)? The workflow still runs (per "runs on every PR") and is expected to pass trivially, since lint/typecheck/test/build over unchanged code should still succeed.
- What happens if the ephemeral Postgres instance fails to start (e.g., resource contention on the runner)? The test job fails as a whole (a real infrastructure dependency is unavailable), which correctly blocks merge rather than silently skipping the affected tests.
- What happens when a PR is opened from a fork? No registry push ever happens on a PR-time run (push only happens on merge to `main`, per Clarifications), so no registry credentials are needed for, or exposed to, fork-originated PR runs; only the image *build* step runs on a PR, which requires no secrets.
- How does the system handle two PRs' workflow runs racing against each other? Each PR's workflow run is isolated per-run (fresh checkout, fresh ephemeral database), so concurrent runs do not interfere with each other.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST automatically run an installation, lint, type-check, test, and build sequence on every pull request opened or updated against the repository.
- **FR-002**: The system MUST fail the workflow run (and thus block merge, given FR-008) when any of the lint, type-check, test, or build steps fails.
- **FR-003**: The system MUST run the module-boundary lint rule as part of the same lint step used for other lint checks, with no separate manual step required.
- **FR-004**: The system MUST provision a real, ephemeral Postgres database instance for the test job, isolated per workflow run, so integration and Row-Level Security tests can execute against real database behavior.
- **FR-005**: The system MUST allow a workflow run with a currently-empty test suite to pass, since at this epic's stage no bounded context yet has real tests.
- **FR-006**: The system MUST build a Docker image as part of the pipeline, and that image MUST be the same image used for both self-hosted distribution and the AWS SaaS deployment (per the project's single-repo, dual-deployment-target model).
- **FR-007**: The Docker image build step MUST run (build only, no registry push) on every pull request, not only on merge to `main`, so that image-build breakage is caught during PR review.
- **FR-008**: The system MUST designate this workflow's status as a required check on the `main` branch, such that a PR failing any gated step cannot be merged.
- **FR-009**: The full pipeline (install, lint, type-check, test, build, image build) MUST complete in under 5 minutes for a typical PR at this epic's stage, to preserve a fast iteration loop for a solo maintainer.
- **FR-010**: The system MUST NOT regress existing Helm chart publishing behavior currently provided by `.github/workflows/helm-publish.yml`; that capability MUST continue to exist, whether folded into this workflow or left as a separate workflow.
- **FR-011**: The system MUST push the built Docker image to its registry only when the pipeline runs on a merge to `main`, never on a PR-time run, so that unmerged/unreviewed images are never published and registry credentials are never exposed to PR-time workflow runs (including fork-originated PRs).

### Key Entities

- **Workflow Run**: A single execution of the CI pipeline against one PR's code state at a point in time; has a pass/fail outcome, a set of step results (lint, type-check, test, build, image-build), and a duration.
- **Required Check**: The named status that GitHub branch protection on `main` watches; a PR cannot merge while its Required Check is failing or pending.
- **Ephemeral Database Instance**: A short-lived Postgres instance provisioned for the lifetime of one workflow run's test job, discarded afterward, used so tests exercise real database behavior instead of mocks.
- **Docker Image Artifact**: The built container image produced by the pipeline, shared as a single artifact between the self-hosted distribution path and the AWS SaaS deployment path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pull requests with a failing test, lint violation (including module-boundary violations), type error, or build failure are blocked from merging.
- **SC-002**: 100% of pull requests that pass all checks — including ones with an empty test suite at this epic's current stage — are able to merge without manual override.
- **SC-003**: The full pipeline completes in under 5 minutes for a typical PR at this epic's stage, measured from workflow trigger to final status.
- **SC-004**: Zero manual steps are required between a PR being opened and its correctness status (pass/fail) being visible to the maintainer.
- **SC-005**: The Docker image produced by the pipeline is successfully usable, without modification, for both the self-hosted distribution path and the AWS SaaS deployment path.

## Assumptions

- Helm chart publishing (`.github/workflows/helm-publish.yml`) is assumed to remain a separate, existing workflow rather than being folded into this new pipeline, since this backlog item does not specify a decision to merge them and folding it in is not required for any stated acceptance criterion; this is called out as an open question for the planning phase to confirm.
- The ephemeral Postgres instance is assumed to be provisioned via a Testcontainers-or-equivalent approach as already decided in `context/testing-strategy.md`, rather than a long-lived shared CI database, so runs stay isolated from one another.
- "Every PR" is assumed to mean every PR targeting `main` specifically (not PRs between arbitrary feature branches), matching how the required-check/branch-protection model in FR-008 is scoped.
- Secrets required for the merge-time registry push (per FR-011) are assumed to already exist or be provisioned outside this feature's scope; this feature covers wiring the build/push steps, not registry credential management itself.
