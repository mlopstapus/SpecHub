# Implementation Plan: CI Pipeline

**Branch**: `004-ci-pipeline` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-ci-pipeline/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Wire a single GitHub Actions workflow that runs on every pull request against `main` — install, lint (including the `003-module-boundary-lint-enforcement` rule already folded into `pnpm lint`), type-check, test (with real, ephemeral Postgres via the existing Testcontainers-backed test suite — no new CI-level database service needed), build, and a Docker image build (build-only, no registry push per the Clarifications decision) — gated behind one required check on `main` so a PR failing any step cannot merge. The image is pushed to the registry only on merge to `main`, keeping registry credentials out of PR-time runs entirely (including fork PRs). Helm chart publishing (`.github/workflows/helm-publish.yml`) stays a separate, untouched workflow (FR-010's explicit either/or, resolved toward "leave separate" since folding it in has no bearing on any acceptance criterion here).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js >=24 (matches `package.json` `engines`)

**Primary Dependencies**: pnpm 10 (`packageManager` pin), Next.js 16, ESLint 9 + `eslint-plugin-boundaries` (existing), TypeScript 5.9, Vitest 4, `@testcontainers/postgresql`/`testcontainers` (existing, already used by `src/shared/db/*.test.ts` via `startTestDb()`), Drizzle ORM/Kit; new: `docker/build-push-action` (or equivalent) for the image build/push steps, `actions/checkout`, `pnpm/action-setup`, `actions/setup-node`

**Storage**: PostgreSQL — but not as a CI-level service container. Existing integration/RLS tests (`src/shared/db/tenant-context.test.ts` etc.) each call `startTestDb()`, which spins up its own ephemeral Testcontainers Postgres instance per test file. The CI runner therefore only needs Docker available (true by default on `ubuntu-latest`) — FR-004 is satisfied by the runner having Docker, not by a `services:` block.

**Testing**: Vitest (`pnpm test` → `vitest run`), including the Testcontainers-backed integration/RLS suite; this feature's own tests are the workflow's behavior itself (see Testing Strategy below), not new Vitest files

**Target Platform**: GitHub Actions, `ubuntu-latest` runners; Docker image built via the repo's own (to-be-authored — see research.md Decision 4) root-level `Dockerfile` for the new Next.js scaffold

**Project Type**: CI/infrastructure feature — adds `.github/workflows/ci.yml` (new) plus a root `Dockerfile`; touches no application source under `src/`

**Performance Goals**: Full pipeline (install → lint → type-check → test → build → docker build) completes in under 5 minutes for a typical PR at this epic's stage (FR-009/SC-003)

**Constraints**: No registry push on PR-time runs (FR-011); single required check on `main` regardless of internal job count (so adding a job later doesn't require re-touching branch protection, see research.md Decision 2); must not regress `helm-publish.yml` (FR-010); must not require any new production secret to be reachable from a fork-originated PR run

**Scale/Scope**: One new workflow file, one new gating (summary) job, five-to-six constituent jobs (install/lint/typecheck/test/build/docker-build), one new root `Dockerfile`; solo-maintainer repo, no matrix builds needed at this stage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Assessment |
|---|---|---|
| I. Test-First Development `[P1]` | Yes — this feature *is* the enforcement mechanism | This feature doesn't add backend domain logic, so there's no red-green cycle over new business logic. Instead it makes Principle I's own "tests are the only correctness signal" enforceable: CI is what turns a passing/failing test suite into an actual merge gate rather than a convention a developer could skip locally. Its own "test" is the quickstart.md validation scenarios (a real PR seen failing, then passing) — see Testing Strategy below. |
| II. Domain-Driven Bounded Contexts `[D1]` | Yes, transitively | FR-003 runs the `003-module-boundary-lint-enforcement` rule as part of the same `pnpm lint` CI step — no new boundary logic is authored here, this feature just makes that existing rule build-breaking in CI instead of only locally. |
| III. Domain Invariants in Domain Layer `[D2]` | No | N/A — no domain model or business rule introduced. |
| IV. Multi-Tenant Isolation `[M1-M3]` | Yes, transitively | FR-004 is what lets integration/RLS tests (which enforce M1-M3 today via `assertCrossTenantDenied` and friends) actually execute in CI. This feature doesn't add tenant logic; it's what makes existing/future tenant-isolation tests count as a real merge gate. |
| V. Secure by Default `[S1-S3]` | Yes | FR-011/Clarifications: registry push only happens on merge to `main`, never on a PR-time run — no registry credential is exposed to, or needed by, a fork-originated PR run. No other secret (DB credentials, JWT secrets) is needed by this workflow, since tests use Testcontainers-provisioned ephemeral instances, not a shared/persistent database. |
| VI. Auditable & Compliant `[C1-C2]` | No | N/A — a CI workflow run is not itself a mutation or cross-tenant-sensitive read path; GitHub's own Actions run log is the audit trail for the pipeline's own execution, which is out of this feature's scope to duplicate. |
| VII. Feature-Gated by Entitlement `[G1]` | No | N/A — a CI workflow is build-time infrastructure, not a product feature/route/tool with a Free-vs-Paid dimension; nothing to gate. |

No violations. Nothing required in Complexity Tracking.

**Post-design re-check** (after Phase 1): The Phase 1 design added a root `Dockerfile`/`.dockerignore` and a `docker-publish` merge-time job (research.md Decisions 3–4) beyond what Technical Context originally scoped in detail. Neither introduces a new principle concern: the `Dockerfile` has no domain/tenant/secret logic of its own, and `docker-publish`'s registry credential is a merge-time-only secret never reachable from PR runs (still satisfies S1-S3, reaffirming the pre-design assessment above). No gate re-opens; still no violations.

## Project Structure

### Documentation (this feature)

```text
specs/004-ci-pipeline/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command) — the required-check contract
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
.github/
  workflows/
    ci.yml                 # NEW — PR-triggered workflow (install/lint/typecheck/test/build/docker-build + ci-gate job)
    docker-publish.yml      # NEW — separate, merge-to-main-only trigger; builds and pushes the image (research.md Decision 3)
    helm-publish.yml        # UNCHANGED — stays separate per FR-010's resolved either/or

Dockerfile                  # NEW — root-level image build for the new Next.js scaffold (research.md Decision 4);
                             # shared by self-hosted distribution and the AWS SaaS deploy per FR-006/PDR-006
.dockerignore                # NEW — alongside the Dockerfile, so the build context excludes legacy/, node_modules/, .git/
```

**Structure Decision**: Single project (the root-level Next.js/TypeScript scaffold per `context/repo-structure.md`). This feature adds only CI configuration (`.github/workflows/ci.yml`) and the root `Dockerfile`/`.dockerignore` the image-build job needs — it does not touch `src/` at all. `legacy/backend/` and `legacy/frontend/` are explicitly out of scope (per CLAUDE.md, `docker compose up -d` still targets those, unchanged by this feature).

## Testing Strategy

This feature has no application logic to unit test — its correctness criterion is behavioral: does a real PR against this workflow actually get blocked/allowed per spec.md's acceptance scenarios. Verification is therefore done via the quickstart.md scenarios (temporary branches/PRs deliberately introducing a failing test, a lint violation, a type error, a build break, and a broken Dockerfile, each confirmed to fail the workflow, then reverted) rather than a Vitest suite. This mirrors how `003-module-boundary-lint-enforcement` treated its own lint config as the artifact under test, except here the artifact is a workflow file and the "test" is triggering real GitHub Actions runs.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.
