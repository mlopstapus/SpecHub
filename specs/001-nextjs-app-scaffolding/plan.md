# Implementation Plan: Next.js App Scaffolding

**Branch**: `001-nextjs-app-scaffolding` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-nextjs-app-scaffolding/spec.md`

## Summary

Stand up the single unified Next.js/TypeScript application that replaces the current split `backend/`/`frontend/` layout: a booting App Router project at the repository root, the seven bounded-context folders (each an empty, valid barrel) and four shared folders (`db`, `ui`, `config`, `logging`) laid out exactly per `context/repo-structure.md`, strict TypeScript, ESLint + Prettier, pinned Node/pnpm versions, and `package.json` scripts whose names match what `CLAUDE.md` already documents. No business logic, no DB connection, no module-boundary lint enforcement — those are explicitly later items.

## Technical Context

**Language/Version**: TypeScript (strict mode, project-wide, no per-file opt-out per FR-006), Node.js current Active LTS at implementation time (Node 22 LTS as of this writing — confirm against the actual current LTS before pinning, per research.md)

**Primary Dependencies**: Next.js (App Router), React, ESLint + Prettier, Vitest (test runner stub only — see Testing), pino (declared as `shared/logging`'s dependency; the module itself is a placeholder in this feature, not the full redaction-serializer implementation from `context/api-conventions.md` — see research.md)

**Storage**: N/A for this feature — `shared/db` is a placeholder folder with no live Drizzle connection; the first real schema/connection lands with `002-database-schema-and-tenancy-conventions`'s consuming epic

**Testing**: Vitest, per `context/testing-strategy.md`. This feature only needs a trivial passing test (or equivalent "no tests yet, exit 0" state) — the real test-database/Testcontainers setup is out of scope here per the spec's Assumptions

**Target Platform**: Local development machine (primary target for this feature); the same scaffold is what Docker Compose/Helm and the AWS ECS deploy (`context/deployment.md`) will later containerize — no deploy pipeline work is in this feature's scope

**Project Type**: Single unified web application (Next.js), replacing the split `backend/`/`frontend/` layout — not a multi-project (frontend+backend) structure

**Performance Goals**: N/A — no runtime request-handling logic exists yet; SC-001's "under 5 minutes, fresh clone to running" is the only timing target for this feature

**Constraints**: TypeScript strict mode enforced repo-wide (FR-006); Node.js/package-manager versions pinned in a machine-enforceable way, not documentation-only (FR-012, from the clarification session)

**Scale/Scope**: One Next.js app, 7 bounded-context folders + 4 shared folders, zero business-logic files — the literal starting point of epic `001-typescript-refactor-foundation`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies to this feature? | Status |
|---|---|---|
| I. Test-First Development (Red-Green-Iterate) `[P1]` | Partially — there's no domain logic to TDD yet. The feature's own acceptance criteria (boot, typecheck, lint all pass on the empty scaffold) function as the red/green signal: each starts red (no scaffold exists) and must end green. | PASS |
| II. Domain-Driven Bounded Contexts `[D1]` | Directly — this feature *is* the folder structure D1 depends on. | PASS |
| III. Domain Invariants Live in the Domain Layer `[D2]` | N/A — no domain logic exists yet to misplace. | PASS (N/A) |
| IV. Multi-Tenant Isolation by Default `[M1-M3]` | N/A — no tables or queries exist yet. | PASS (N/A) |
| V. Secure by Default `[S1-S3]` | Partially — `shared/logging` is in scope as a folder, but its full secret-redaction serializer (S3) is deferred; no log-emitting code exists yet in this feature, so there's nothing that could currently leak a secret. Flagged explicitly so the deferral is a tracked decision, not a silent gap — see research.md. | PASS (deferred, documented) |
| VI. Auditable & Compliant (SOC2) `[C1-C2]` | N/A — no mutations, no secrets configuration exists yet in this feature. | PASS (N/A) |
| VII. Feature-Gated by Entitlement `[G1]` | N/A — this is repo scaffolding, not a user-reachable feature (no REST route, MCP tool, or UI surface ships here). | PASS (N/A) |

No violations requiring justification — Complexity Tracking table is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-nextjs-app-scaffolding/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output (N/A — no data entities in this feature)
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
# Single unified Next.js/TypeScript application at the repo root,
# replacing the current split backend/ + frontend/ layout (FR-011).
# Exact tree per context/repo-structure.md (as amended by this feature's
# clarification session to add shared/logging):

src/
  app/                          # Next.js App Router — routes only
    api/                        # REST route handlers (empty at this stage)
    mcp/                        # MCP tool handlers (empty at this stage)
    (app)/                      # UI routes (empty at this stage)
  bcs/
    identity-access/
      index.ts                  # barrel — no exports yet
      domain/
      application/
      infrastructure/
    governance/            (same sub-structure)
    prompt-registry/        (same sub-structure)
    workflow-orchestration/ (same sub-structure)
    billing-entitlements/   (same sub-structure)
    audit-compliance/       (same sub-structure)
    distribution/           (same sub-structure)
  shared/
    db/                          # placeholder — Drizzle client wiring lands later
    ui/                          # placeholder — shared components land later
    config/                      # placeholder — env parsing lands later
    logging/                     # placeholder barrel — full pino wiring lands with first real logging consumer

legacy/
  backend/                       # relocated current Python/FastAPI backend (reference only, not run)
  frontend/                      # relocated current Next.js frontend (reference only, not run)

package.json                     # pnpm scripts: dev, build, lint, typecheck, test — names match CLAUDE.md
tsconfig.json                    # strict: true, no per-file/per-folder override
.eslintrc / eslint.config.mjs
.prettierrc
.nvmrc / "engines" + "packageManager" fields in package.json
```

**Structure Decision**: Single project (not a frontend+backend split) at the repository root, matching `context/repo-structure.md` exactly (four `shared/` folders as of this feature's clarification session, not three). The current `backend/` and `frontend/` are relocated to `legacy/` rather than deleted, satisfying FR-011 and the spec's Assumption that old code remains available as a porting reference without occupying the root.
