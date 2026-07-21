# Feature Specification: Module Boundary Lint Enforcement

**Feature Branch**: `003-module-boundary-lint-enforcement`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "backlog/001-typescript-refactor-foundation/003-module-boundary-lint-enforcement.md"

## Clarifications

### Session 2026-07-21

- Q: FR-002 forbids importing another BC's Drizzle schema/model files "directly." If a BC's barrel re-exports its own schema/model objects, should the rule also block importing those objects via the barrel? → A: No — only forbid direct internal-path imports of schema/model files; barrels re-exporting schemas is a barrel-design/CONTRACT.md concern, not something this path-based lint rule checks.
- Q: Should test files (e.g. `*.test.ts`) be exempt from the boundary rule, allowing them to reach into another BC's internals directly (e.g. to seed fixtures)? → A: No exemption — test files are held to the same barrel-only rule as production code, with no special-casing by filename pattern.
- Q: Should type-only imports (`import type { X } from '...'`) across bounded contexts be exempt from the boundary rule, since they impose no runtime coupling? → A: No exemption — type-only imports are held to the same barrel-only rule as regular imports.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Blocked cross-context internal import (Priority: P1)

A developer working in one bounded context (e.g. `governance`) writes code that imports directly from another bounded context's internal folder (e.g. `src/bcs/identity-access/domain/user.ts`) instead of going through that context's public barrel. When they run the lint check (locally or in CI), the violation is reported as a lint error, not a warning, and the build/CI run fails.

**Why this priority**: This is the entire point of the feature — without a build-breaking failure, the boundary is just a convention someone has to remember, which is the exact failure mode tenet D1 exists to close.

**Independent Test**: Add a deliberately-broken import from one bounded context's non-barrel path into another's, run `pnpm lint`, and confirm it exits non-zero with an error referencing the violating file.

**Acceptance Scenarios**:

1. **Given** a file in `src/bcs/governance/` that imports from `src/bcs/identity-access/domain/*` (bypassing `identity-access`'s `index.ts`), **When** `pnpm lint` runs, **Then** it fails with a lint error identifying the offending import.
2. **Given** the same scenario, **When** the error message is inspected, **Then** it clearly states the import crosses a bounded-context boundary and directs the developer to the violated context's `CONTRACT.md`.

---

### User Story 2 - Barrel-only import passes cleanly (Priority: P1)

A developer needs functionality from another bounded context and imports it through that context's `index.ts` barrel (e.g. `import { X } from '@/bcs/identity-access'`), exactly as the architecture intends. Lint must not flag this as an error.

**Why this priority**: A rule that also blocks the sanctioned integration path would make the boundary unusable and force developers to work around the linter rather than through it — equally damaging to adoption as no rule at all.

**Independent Test**: Add an import that only reaches into another bounded context via its `index.ts` barrel, run `pnpm lint`, and confirm it passes with no errors related to boundary enforcement.

**Acceptance Scenarios**:

1. **Given** a file in `src/bcs/governance/` that imports only from `src/bcs/identity-access` (the barrel, not an internal path), **When** `pnpm lint` runs, **Then** no boundary-related lint error is produced for that import.
2. **Given** a file anywhere in `src/` that imports from `src/shared/*`, **When** `pnpm lint` runs, **Then** no boundary-related lint error is produced, regardless of which bounded context the importing file belongs to.

---

### User Story 3 - Enforced automatically in CI, not just locally (Priority: P2)

A developer skips running lint locally, or lint is misconfigured on their machine, and pushes a change containing a boundary violation. The CI pipeline must independently catch it before the change can merge.

**Why this priority**: Local-only enforcement is easy to bypass by accident (stale config, skipped pre-commit hook); the acceptance criteria explicitly require the rule to be wired into CI so the guarantee holds regardless of any individual developer's local setup.

**Independent Test**: Push a branch containing a boundary violation to CI (or trigger the CI lint step directly) and confirm the pipeline run fails on the lint step.

**Acceptance Scenarios**:

1. **Given** a branch with a deliberate boundary violation and no local lint run, **When** the CI pipeline executes its lint step, **Then** the pipeline run fails.
2. **Given** a branch with only barrel-compliant imports, **When** the CI pipeline executes its lint step, **Then** the boundary check passes.

### Edge Cases

- What happens when a bounded context imports its *own* internal files (e.g. `application/` importing from `domain/` within the same context)? This MUST continue to pass — the rule only restricts *cross-context* internal access, not intra-context structure.
- What happens when a bounded context's `index.ts` barrel itself imports from its own internal folders to re-export them? This MUST pass — the barrel is the one file in each context permitted to reach into that context's own internals for the purpose of re-exporting.
- What happens when a Drizzle schema/model file in one bounded context is imported directly by another context, even if other internal files in the source context are not touched? This MUST fail — model/schema files are explicitly named in the requirements as never directly importable cross-context, even if a general internal-path rule were somehow narrower.
- What happens when code outside `src/bcs/*` entirely (e.g. `src/app/`) imports directly from a bounded context's internal folder instead of its barrel? This MUST fail using the same rule, since the boundary is about barrel-only access to each context, not specifically about BC-to-BC traffic.
- What happens when a new bounded context folder is added under `src/bcs/`? The rule MUST apply to it automatically without per-context configuration changes, since the requirements describe a general pattern match on `src/bcs/<name>/` rather than an enumerated allowlist.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The lint configuration MUST forbid any import that reaches into a bounded context's internal path (anything under `src/bcs/<name>/` other than that context's `index.ts` barrel) from outside that same context.
- **FR-002**: The lint configuration MUST forbid a bounded context from importing another bounded context's Drizzle schema/model files via a direct internal-path import, even as a specific case of FR-001. Whether a schema/model object is re-exported through the owning BC's barrel (and thus importable that way) is a barrel-design decision governed by that BC's `CONTRACT.md`, not something this rule enforces by inspecting import contents.
- **FR-003**: The lint configuration MUST allow imports from `src/shared/*` from any location in the codebase, without restriction.
- **FR-004**: The lint configuration MUST allow a bounded context's own files to import from its own internal folders (intra-context imports are unrestricted).
- **FR-005**: A violating import MUST produce a lint error (not a warning) that causes `pnpm lint` to exit non-zero.
- **FR-006**: The lint error message for a boundary violation MUST clearly identify that the failure is a bounded-context boundary violation and MUST point the developer at the violated context's `CONTRACT.md` file.
- **FR-007**: The lint rule MUST be wired into the CI pipeline's checks so that a boundary violation fails the pipeline run, not only a local `pnpm lint` invocation.
- **FR-008**: The lint rule MUST apply generically to any bounded context under `src/bcs/`, including ones added after the rule is introduced, without requiring a configuration change per new context.
- **FR-009**: The lint rule MUST apply to test files exactly as it applies to production code — no exemption based on filename pattern (e.g. `*.test.ts`) for reaching into another bounded context's internals.
- **FR-010**: The lint rule MUST apply to type-only imports (e.g. `import type { X } from '...'`) exactly as it applies to regular value imports — no exemption for imports that are erased at runtime.

### Key Entities

- **Bounded Context (BC)**: A folder under `src/bcs/<name>/` (e.g. `identity-access`, `governance`, `prompt-registry`) that owns its own domain/application/infrastructure internals and exposes a public surface via `index.ts`.
- **Barrel (`index.ts`)**: The single sanctioned entry point for a bounded context's public surface; the only file external code may import from to reach that context.
- **Shared module (`src/shared/*`)**: Code that is not scoped to any bounded context and is importable from anywhere without restriction.
- **CONTRACT.md**: Per-bounded-context documentation of that context's public contract, referenced in lint error messages so a developer hitting a violation knows where to find the sanctioned integration path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of deliberately-introduced cross-context internal-path imports are caught by lint, both locally and in CI, with zero false negatives for any bounded-context pair (verified directly for at least two distinct pairs, and by design for the remaining seven existing bounded contexts).
- **SC-002**: 100% of barrel-only and intra-context imports pass lint with zero false positives, so the rule never blocks the sanctioned integration path.
- **SC-003**: A developer encountering a boundary violation can identify which context's contract was violated and where to find it directly from the lint error text, without needing to ask a teammate or consult external documentation.
- **SC-004**: No merge to the main branch can introduce a new cross-context internal import without CI failing, verified by the CI pipeline rejecting a test branch containing such a violation.

## Assumptions

- The seven bounded contexts enumerated in `context/repo-structure.md` (`prompt-registry`, `distribution`, `identity-access`, `governance`, `audit-compliance`, `workflow-orchestration`, `billing-entitlements`) and their `index.ts` barrels already exist per the completed repo-structure/scaffolding work, so this feature only adds enforcement, not the folder structure itself.
- "Internal path" means anything under a bounded context's folder other than its top-level `index.ts` (i.e. `domain/`, `application/`, `infrastructure/`, and any other non-barrel file at any depth within that context).
- The specific lint tool (e.g. an ESLint plugin such as `eslint-plugin-boundaries` or a standalone tool such as `dependency-cruiser`) is an implementation detail left to the planning phase; this specification only constrains observable behavior (what passes/fails and the resulting message), not the tool chosen.
- CI wiring depends on a CI pipeline existing to wire into (tracked separately as `004-ci-pipeline` per the source backlog item's Acceptance Criteria); this feature's CI-facing requirement (FR-007) assumes that pipeline is present or landing alongside this work.
- Enforcement is static (import-graph analysis at lint time), not a runtime check — consistent with the source item calling this "a lint rule" and framing violations as failing `pnpm lint`/CI.
