---

description: "Task list for Module Boundary Lint Enforcement"
---

# Tasks: Module Boundary Lint Enforcement

**Input**: Design documents from `/specs/003-module-boundary-lint-enforcement/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (no `contracts/` — see plan.md)

**Tests**: Included. The plan's Constitution Check commits to a red-green cycle for the lint config itself (Principle I, in spirit), and quickstart.md names the exact fixture-test file this depends on.

**Organization**: Tasks are grouped by user story (US1/US2/US3 from spec.md), in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/temp fixtures, no blocking dependency)
- **[Story]**: Which user story this task belongs to
- Nearly all core tasks share two files (`eslint.config.mjs`, `eslint.config.test.ts`), so most are marked sequential rather than [P] — this is a small, config-only feature with limited real parallelism.

## Path Conventions

Single project at repository root (`src/`, `eslint.config.mjs`, `package.json`) per `context/repo-structure.md` and plan.md's Structure Decision.

---

## Phase 1: Setup

**Purpose**: Baseline and dependency installation

- [X] T001 [P] Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` at the repo root to record a clean baseline before any change
- [X] T002 Add `eslint-plugin-boundaries` as a devDependency in `package.json`, run `pnpm install`, and confirm (via its README/peerDependencies) it supports ESLint 9's flat config — per CLAUDE.md's `eslint@^9` pin, do not introduce a version requiring `FlatCompat` or an incompatible ESLint major

**Checkpoint**: Dependency installed, baseline recorded

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared element-type vocabulary both user stories build on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 In `eslint.config.mjs`, register the `boundaries` plugin and define `settings["boundaries/elements"]` with three element types: `bc` (pattern `src/bcs/*`, capturing the BC folder name as `category`), `shared` (pattern `src/shared`), and `app` (pattern `src/app`) — no trailing `**` on any pattern (`partialMatch` already expands folder patterns internally; see data-model.md and research.md Decision 1a for why an explicit `**` breaks intra-context detection, and why `app` must be declared). Add no enforcement rules yet.

**Checkpoint**: Element-type settings exist; foundation ready for both user stories

---

## Phase 3: User Story 1 - Blocked cross-context internal import (Priority: P1) 🎯 MVP

**Goal**: A cross-context import that bypasses another bounded context's `index.ts` barrel fails `pnpm lint` as an error, with a message naming the violated context's `CONTRACT.md`.

**Independent Test**: Add a deliberately-broken import from one BC's non-barrel path into another's, run `pnpm lint`, confirm non-zero exit with a clear error (quickstart.md Scenario 1).

### Tests for User Story 1 ⚠️

> Write these first; confirm each fails for the right reason before the corresponding implementation task

- [X] T004 [US1] In new file `eslint.config.test.ts`, write a fixture test using ESLint's `Linter.verify()`/`ESLint.lintText()` with a virtual file path under `src/bcs/governance/application/` containing an import from a virtual specifier resolving under `src/bcs/identity-access/domain/`, asserting the lint result contains an **error-severity** diagnostic (severity `2`, not a `1`/warning) — this is what actually proves FR-005 ("error, not a warning"). Run it and confirm it fails (red) — no rule exists yet to produce that diagnostic.

### Implementation for User Story 1

- [X] T005 [US1] In `eslint.config.mjs`, configure the canonical `boundaries/dependencies` rule (not the deprecated `boundaries/entry-point`/`boundaries/element-types` aliases) at `"error"` severity with `default: "allow"` and exactly two ordered policies: (1) `disallow: { to: { element: { type: "bc", fileInternalPath: "!index.ts" } } }` — denies reaching into any `bc`'s non-barrel files from anywhere; (2) `allow: { dependency: { relationship: { to: "internal" } } }` — placed *after* policy 1 so it overrides the disallow for same-instance (intra-context) imports, per data-model.md's Decision Logic. Depends on T003; must make T004 pass.
- [X] T006 [US1] Add a `message` option to policy 1 from T005 (or at the rule's top level) using the template `"{{to.element.captured.category}} is a bounded-context boundary — import via its barrel (src/bcs/{{to.element.captured.category}}/index.ts) or see bcs/{{to.element.captured.category}}/CONTRACT.md"` so the error text states the import crosses a bounded-context boundary and names the specific `CONTRACT.md` (per data-model.md's Decision Logic and research.md Decision 3). Depends on T005.
- [X] T007 [US1] In `eslint.config.test.ts`, add a fixture test asserting the error message from T004's scenario contains the literal substring `bcs/identity-access/CONTRACT.md`. Depends on T006.
- [X] T008 [US1] In `eslint.config.test.ts`, add a fixture test using a virtual filename ending in `.test.ts` with the same cross-context internal import as T004, asserting an error-severity diagnostic is still produced (FR-009 — no test-file exemption). Depends on T005.
- [X] T009 [US1] In `eslint.config.test.ts`, add a fixture test using `import type { X } from "..."` (not a value import) for the same cross-context internal import as T004, asserting an error-severity diagnostic is still produced (FR-010 — no type-only-import exemption). Depends on T005.
- [X] T010 [US1] In `eslint.config.test.ts`, add a fixture test for a virtual file under one BC directly importing another BC's top-level schema/model file path (e.g. `src/bcs/identity-access/schema.ts` or an `infrastructure/` model file), asserting an error-severity diagnostic is produced (FR-002 — schema/model is a strict subset of the general internal-path rule, per research.md Decision 2). Depends on T005.
- [X] T011 [US1] In `eslint.config.test.ts`, add a fixture test asserting a virtual file under `src/app/` importing directly from `src/bcs/governance/domain/*` (bypassing the barrel) produces an error-severity diagnostic identical in kind to the bc-to-bc case — this is the explicit test for spec.md's "code outside `src/bcs/*` entirely" edge case, which FR-001's "from outside that same context" phrasing already covers but which no earlier task exercises. Depends on T005.
- [X] T012 [US1] In `eslint.config.test.ts`, add a fixture test using a **second, different** bounded-context pair (e.g. `prompt-registry` importing directly from `src/bcs/billing-entitlements/domain/*`), asserting an error-severity diagnostic is produced — direct evidence for SC-001's "any bounded-context pair" claim beyond the single governance/identity-access example used elsewhere in this phase. Depends on T005.
- [X] T013 [US1] Follow quickstart.md Scenario 1 end-to-end: add a real temporary violating file under `src/bcs/governance/application/`, run `pnpm lint`, confirm non-zero exit and the CONTRACT.md-referencing message appear in the actual CLI output, then delete the temporary file. Depends on T006.

**Checkpoint**: User Story 1 is fully functional and independently testable — the deny path works, with no exemptions for test files or type-only imports, verified across two BC pairs and the `src/app/` case.

---

## Phase 4: User Story 2 - Barrel-only import passes cleanly (Priority: P1)

**Goal**: Imports through a bounded context's barrel, from `src/shared/*`, or within the same context are never flagged.

**Independent Test**: Add an import that only reaches another BC via its `index.ts` barrel (or `src/shared/*`, or intra-context), run `pnpm lint`, confirm no boundary-related error (quickstart.md Scenarios 2–4).

### Tests for User Story 2 ⚠️

- [X] T014 [US2] In `eslint.config.test.ts`, add a fixture test asserting a virtual file in one `bc` importing another `bc`'s entry point (barrel specifier, e.g. `@/bcs/identity-access`) produces no boundary error. Depends on T005.
- [X] T015 [US2] In `eslint.config.test.ts`, add a fixture test asserting a virtual file anywhere in `src/` importing from `src/shared/**` produces no boundary error. Depends on T005.
- [X] T016 [US2] In `eslint.config.test.ts`, add a fixture test asserting a virtual file inside one `bc` importing another file within the *same* `bc` instance (e.g. `application/` importing `domain/`) produces no boundary error. Depends on T005.
- [X] T017 [US2] In `eslint.config.test.ts`, add a fixture test asserting a `bc`'s own `index.ts` importing its own internal folders (to re-export them) produces no boundary error. Depends on T005.

### Implementation for User Story 2

- [X] T018 [US2] Follow quickstart.md Scenarios 2–4 end-to-end: add real temporary files exercising a barrel import, a `src/shared/*` import, and an intra-context import, run `pnpm lint`, confirm zero boundary-related errors, then delete the temporary files. Depends on T014, T015, T016, T017. (No new `eslint.config.mjs` changes expected — this phase proves T005/T006 introduced no false positives.)

**Checkpoint**: User Stories 1 AND 2 both work independently — deny and allow paths are both proven, with zero false positives.

---

## Phase 5: User Story 3 - Enforced automatically in CI, not just locally (Priority: P2)

**Goal**: A boundary violation fails the CI pipeline, not only a local `pnpm lint` run.

**Independent Test**: Trigger the CI lint step (or the equivalent local command) on a branch with a boundary violation and confirm it fails (quickstart.md Scenario 6 covers the automated-suite proxy for this).

- [X] T019 [US3] Run `pnpm lint` at the repo root with a deliberately reintroduced violation (repeat quickstart.md Scenario 1), confirming non-zero exit using the exact command `backlog/001-typescript-refactor-foundation/004-ci-pipeline.md` commits to invoking in its lint step; then confirm a clean `pnpm lint` run exits zero. Depends on T006. No new CI workflow file is authored by this task — FR-007 is satisfied transitively once `004-ci-pipeline` wires `pnpm lint` into GitHub Actions (research.md Decision 5); this feature alone does not fully close FR-007/SC-004 until that separate item lands.

**Checkpoint**: All three user stories independently verified — CI enforcement is confirmed to require no additional work from this feature beyond keeping the rule inside `pnpm lint`.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Follow quickstart.md Scenario 7: create a temporary `src/bcs/__quickstart_new_bc/` folder with an `index.ts` and a `domain/` file, add a violating cross-context import into it from an existing BC, run `pnpm lint`, confirm it's caught with zero `eslint.config.mjs` changes (FR-008), then delete the temporary folder. Depends on T006.
- [X] T021 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` across the full repo to confirm no regressions from the new rule, comparing against the T001 baseline. Depends on all of Phase 1–5 (T001–T020).
- [X] T022 Update `backlog/001-typescript-refactor-foundation/003-module-boundary-lint-enforcement.md`'s Requirements/Acceptance Criteria checkboxes to reflect what's actually done. **Deviation from the original task**: the item's own third Acceptance Criterion ("Rule is wired into the CI pipeline... not just available locally") is genuinely unmet — `004-ci-pipeline` doesn't exist yet — so per CLAUDE.md's convention (archive only *completed* items), `status` stays `open` and the file stays in place rather than moving to `archive/`. Depends on T021.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS both user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — no dependency on US2/US3
- **User Story 2 (Phase 4)**: Depends on Foundational and on US1's rule existing (T005/T006) to have anything to verify against, but is conceptually independent (proves no regressions in the allow path)
- **User Story 3 (Phase 5)**: Depends on US1's rule (T006) being part of `pnpm lint`
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests written and shown to fail before the corresponding implementation task (T004 before T005; T014–T017 before T018 confirms no regressions rather than driving new code)
- `eslint.config.mjs` changes (T003, T005, T006) are strictly sequential — same file
- `eslint.config.test.ts` additions (T004, T007–T012, T014–T017) are strictly sequential — same file

### Parallel Opportunities

- T001 (baseline check) has no dependencies and can run immediately
- T020 (new-BC regression, Phase 6) touches a distinct temporary folder and only depends on T006, so it can run any time after Phase 3 completes, in parallel with Phase 4/5 work
- Real parallelism is otherwise limited: this feature concentrates almost all change in two shared files (`eslint.config.mjs`, `eslint.config.test.ts`), so most tasks are sequential by nature rather than by artificial ordering

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 — this alone delivers a build-breaking boundary rule with a clear message, the core value tenet D1 requires
4. **STOP and VALIDATE**: quickstart.md Scenario 1
5. Continue to US2 to prove no false positives before considering the rule safe to rely on

### Incremental Delivery

1. Setup + Foundational → element-type vocabulary ready
2. User Story 1 → deny path works and is message-complete (MVP)
3. User Story 2 → allow path proven regression-free
4. User Story 3 → confirmed CI-ready with no extra work
5. Polish → full-repo regression check, FR-008 generalization proof, backlog item archived

---

## Notes

- [P] tasks = different files or independent temp fixtures, no blocking dependency
- Verify each red test (T004) fails for the right reason (no rule exists) before writing the implementation task that turns it green
- Delete every temporary file/folder created for a manual quickstart scenario before moving to the next task
- Commit after each task or logical group
