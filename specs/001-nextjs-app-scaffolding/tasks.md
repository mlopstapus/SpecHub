---

description: "Task list for Next.js App Scaffolding"
---

# Tasks: Next.js App Scaffolding

**Input**: Design documents from `/specs/001-nextjs-app-scaffolding/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md (N/A), contracts/, quickstart.md

**Tests**: Not explicitly requested beyond the trivial passing smoke test spec.md's Assumptions call for (real test-database setup is out of scope for this feature) — no TDD contract/integration test tasks are generated here.

**Organization**: Tasks are grouped by user story. Note on this feature specifically: because this is an infrastructure-scaffolding feature (not a feature with independently buildable business slices), the three user stories are largely three **verification lenses over one shared scaffold** rather than separable implementation slices — most substantive file creation happens in Setup/Foundational, and each user story's phase is primarily its checkpoint validation (plus fixes if validation fails). This is called out explicitly in Implementation Strategy below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Single unified Next.js project at the repository root, per `plan.md`'s Project Structure: `src/app/`, `src/bcs/`, `src/shared/`, `legacy/backend/`, `legacy/frontend/`.

---

## Phase 1: Setup

**Purpose**: Project initialization and basic tooling

- [X] T001 Initialize pnpm-managed Next.js (App Router) TypeScript project scaffold: `package.json`, `next.config.ts`, `tsconfig.json` (strict mode, no per-file/per-folder opt-out, per FR-006)
- [X] T002 [P] Pin Node.js/pnpm versions machine-enforceably per FR-012: `engines` and `packageManager` fields in `package.json`, plus `.nvmrc`
- [X] T003 [P] Relocate `backend/` → `legacy/backend/` via `git mv`, preserving history (FR-011)
- [X] T004 [P] Relocate `frontend/` → `legacy/frontend/` via `git mv`, preserving history (FR-011)
- [X] T005 [P] Configure ESLint flat config `eslint.config.mjs`, matching or improving on `legacy/frontend/.eslintrc.json` (per research.md's lint-tooling decision)
- [X] T006 [P] Configure Prettier `.prettierrc`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The core scaffold every user story's checkpoint validates against

**⚠️ CRITICAL**: No user story checkpoint can be validated until this phase is complete

- [X] T007 Add a minimal root route so the app has something to render: `src/app/layout.tsx`, `src/app/page.tsx` (depends on T001)
- [X] T008 Create the seven bounded-context barrel folders per `contracts/bounded-context-barrel.md`: `src/bcs/identity-access/index.ts`, `src/bcs/governance/index.ts`, `src/bcs/prompt-registry/index.ts`, `src/bcs/workflow-orchestration/index.ts`, `src/bcs/billing-entitlements/index.ts`, `src/bcs/audit-compliance/index.ts`, `src/bcs/distribution/index.ts` (each exporting nothing yet, plus empty `domain/`, `application/`, `infrastructure/` subfolders per each) (depends on T001)
- [X] T009 Create the four shared placeholder folders per `context/repo-structure.md`: `src/shared/db/index.ts`, `src/shared/ui/index.ts`, `src/shared/config/index.ts`, `src/shared/logging/index.ts` (depends on T001)
- [X] T010 [P] Configure Vitest minimal setup with one trivial passing smoke test: `vitest.config.ts`, `src/__smoke__/scaffold.test.ts`
- [X] T011 Wire `package.json` scripts (`dev`, `build`, `lint`, `typecheck`, `test`) per `contracts/package-scripts.md`, matching the names already referenced in `CLAUDE.md` (depends on T001, T005, T006, T010)

**Checkpoint**: Foundation ready — `pnpm install && pnpm dev` should already work, folders exist, all scripts are wired. User story phases below validate this and fix any gaps.

---

## Phase 3: User Story 1 - Boot the scaffold locally (Priority: P1) 🎯 MVP

**Goal**: A developer can go from a fresh clone to a running local app with zero errors.

**Independent Test**: Install dependencies and start the dev server; verify a running local app with no build/runtime errors, independent of any bounded-context logic existing.

### Validation for User Story 1

- [X] T012 [US1] Run `pnpm install && pnpm dev`; verify the app boots and serves the root route with zero terminal/browser-console errors (spec.md acceptance scenario 1)
- [X] T013 [US1] Stop and restart `pnpm dev`; verify it boots again with no additional manual setup steps (spec.md acceptance scenario 2)
- [X] T014 [US1] Fix any boot-blocking issue found in T012/T013 in `src/app/layout.tsx`, `src/app/page.tsx`, or `next.config.ts`

**Checkpoint**: User Story 1 independently verified — the app boots reliably.

---

## Phase 4: User Story 2 - Confirm the folder structure matches the decided architecture (Priority: P2)

**Goal**: The seven bounded-context folders and four shared folders exist exactly as `context/repo-structure.md` specifies.

**Independent Test**: Inspect the repository's folder tree against `context/repo-structure.md` and confirm each named folder and entry-point file exists, independent of the app running.

### Validation for User Story 2

- [X] T015 [P] [US2] Diff `src/bcs/*` against `context/repo-structure.md`'s seven bounded contexts; confirm each `index.ts` is present, exports nothing, and compiles (spec.md acceptance scenario 1)
- [X] T016 [P] [US2] Diff `src/shared/*` against `context/repo-structure.md`'s four shared folders (`db`, `ui`, `config`, `logging`); confirm all four are present in the specified location (spec.md acceptance scenario 2)
- [X] T017 [US2] Fix any structural mismatch found in T015/T016 directly under `src/bcs/` or `src/shared/`

**Checkpoint**: User Story 2 independently verified — folder structure matches `context/repo-structure.md` exactly.

---

## Phase 5: User Story 3 - Rely on working quality gates from day one (Priority: P3)

**Goal**: Type-checking, linting, and the test command all run cleanly against the empty scaffold.

**Independent Test**: Run the type-check and lint commands against the scaffold with no feature code added, independent of the dev server running.

### Validation for User Story 3

- [X] T018 [P] [US3] Run `pnpm typecheck`; verify zero errors (spec.md acceptance scenario 1)
- [X] T019 [P] [US3] Run `pnpm lint`; verify zero errors or warnings (spec.md acceptance scenario 2)
- [X] T020 [US3] Run `pnpm test`; verify the trivial smoke test (T010) passes
- [X] T021 [US3] Fix any gate failure found in T018-T020 in `tsconfig.json`, `eslint.config.mjs`, or `vitest.config.ts`

**Checkpoint**: User Story 3 independently verified — quality gates are known-good before any feature code lands.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Keep the project's own documentation and version-pinning promises honest now that the scaffold exists

- [X] T022 [P] Update `CLAUDE.md`'s command table to the new root-level `pnpm` scripts, removing the `cd backend`/`cd frontend` split (depends on Phase 2-5 completion)
- [X] T023 [P] Update `.claude/anchorstack/project.md` if it references the old `backend/`/`frontend/` commands, per the source backlog item's note that `as-setup-project` should be re-runnable cleanly after this epic
- [X] T024 [P] Update root `README.md` setup instructions to the new root-level commands (old `legacy/backend/`, `legacy/frontend/` no longer describe how to run the app)
- [X] T025 Deliberately mismatch the local Node.js version and run `pnpm install`; verify a clear version-mismatch error per FR-012 (depends on T002)
- [X] T026 Run every section of `quickstart.md` end-to-end and confirm each command succeeds, including SC-004's full command-surface check

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user story checkpoints
- **User Stories (Phase 3-5)**: All depend on Foundational completion; can be validated in parallel or in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all three user story checkpoints passing (T022/T023/T024 reference the finished command surface; T025/T026 exercise the finished scaffold end-to-end)

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on US2/US3
- **User Story 2 (P2)**: Can start after Foundational — no dependency on US1/US3
- **User Story 3 (P3)**: Can start after Foundational — no dependency on US1/US2 (T020's smoke test doesn't require US1's route content or US2's real BC content, since both are placeholders)

### Parallel Opportunities

- T002, T003, T004, T005, T006 (Setup) can all run in parallel — different files
- T010 (Foundational) can run in parallel with T007/T008/T009 — different files; T011 depends on all of T001/T005/T006/T010
- Once Foundational (Phase 2) completes, Phase 3 (US1), Phase 4 (US2), and Phase 5 (US3) validation can all run in parallel — they inspect/exercise different aspects of the same finished scaffold and don't modify shared files unless a fix is needed
- T015 and T016 (both US2) can run in parallel — different folders
- T018 and T019 (both US3) can run in parallel — different commands, no shared file writes
- T022, T023, T024 (Polish) can run in parallel — different documentation files

---

## Parallel Example: Setup

```bash
# Launch Setup's independent tasks together:
Task: "Pin Node.js/pnpm versions in package.json (engines, packageManager) and .nvmrc"
Task: "Relocate backend/ to legacy/backend/ via git mv"
Task: "Relocate frontend/ to legacy/frontend/ via git mv"
Task: "Configure ESLint flat config eslint.config.mjs"
Task: "Configure Prettier .prettierrc"
```

## Parallel Example: User Story Checkpoints (post-Foundational)

```bash
# Once Phase 2 is complete, validate all three stories together:
Task: "US1 — pnpm install && pnpm dev; verify boot with zero errors"
Task: "US2 — diff src/bcs/* and src/shared/* against context/repo-structure.md"
Task: "US3 — run pnpm typecheck, pnpm lint, pnpm test; verify zero errors"
```

---

## Implementation Strategy

### Why this feature's stories aren't independently *buildable*

Unlike a typical product feature, User Stories 1-3 here don't each add new functionality on top of the last — they're three acceptance lenses on the one scaffold Setup + Foundational produces (booting, folder structure, quality gates). There is no meaningful way to ship "just US2" without also having done the Foundational work US1 and US3 also validate. Practically: **do Setup and Foundational fully, then run all three story checkpoints**, fixing forward in whichever phase's checkpoint fails.

### MVP First

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (this is where nearly all real file creation happens)
3. Complete Phase 3: User Story 1 checkpoint — **this alone is a legitimate MVP**: a booting app is the literal prerequisite every later epic needs, even before folder structure or gates are double-checked
4. **STOP and VALIDATE**: `pnpm dev` boots cleanly
5. Continue to US2 and US3 checkpoints before calling the feature done — both are cheap once Foundational is solid

### Incremental Delivery

1. Setup + Foundational → scaffold exists
2. US1 checkpoint → confirms it boots (MVP signal)
3. US2 checkpoint → confirms structure is correct (unblocks later epics trusting the folder layout)
4. US3 checkpoint → confirms gates are trustworthy (unblocks later epics trusting CI)
5. Polish → keeps docs and version-pinning promises in sync with what was actually built

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This feature intentionally does not include: module-boundary lint enforcement (separate later item), a real `shared/db` connection, real `shared/logging` pino wiring, or any UI theming — see plan.md's Technical Context and research.md
- Commit after each phase, not necessarily after each task, given how interlinked Setup/Foundational are for this particular feature
