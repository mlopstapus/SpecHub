# Feature Specification: Next.js App Scaffolding

**Feature Branch**: `001-nextjs-app-scaffolding`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "/Users/ben/repos/SkillCanon/backlog/001-typescript-refactor-foundation/001-nextjs-app-scaffolding.md"

## Clarifications

### Session 2026-07-21

- Q: `context/repo-structure.md` (which this feature's FR-005/FR-010 point to) lists exactly three `shared/` folders (db, ui, config), but `context/api-conventions.md`'s logging schema decision requires a shared `shared/logging` module every bounded context imports from — should this feature's scope include a fourth `shared/logging` folder to close that gap? → A: Yes — add `shared/logging` to this feature's scope now, and `context/repo-structure.md` has been updated to list it as a fourth shared folder.
- Q: Should the required Node.js/package-manager versions be pinned in a machine-enforceable way (e.g. `engines` + `packageManager` fields), or left as documentation only? → A: Pinned via `engines` + `packageManager` fields — reproducible installs across dev machines and CI without a separate version-manager dependency.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Boot the scaffold locally (Priority: P1)

As the developer building SkillCanon, I need a working, empty Next.js/TypeScript project that starts successfully out of the box, so I have a real foundation to build the seven bounded contexts and their features into, instead of scaffolding tooling from scratch during every future epic.

**Why this priority**: Without an app that actually boots, no other epic — every one of which layers business logic and UI into this scaffold — can start. This is the literal prerequisite for everything downstream.

**Independent Test**: Can be fully tested by installing dependencies and starting the dev server; delivers a running local app with no build or runtime errors, verifiable without any bounded-context logic existing yet.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** a developer runs the install and dev commands, **Then** the application starts and serves a page with no errors in the terminal or browser console.
2. **Given** the app is running, **When** a developer stops and restarts it, **Then** it boots again without requiring any additional manual setup steps.

---

### User Story 2 - Confirm the folder structure matches the decided architecture (Priority: P2)

As the developer, I need the seven bounded-context folders and the shared folders already present with their intended entry points, so that when a future epic starts implementing a bounded context's logic, there's an unambiguous, already-agreed-upon place for that code to live rather than a folder-structure decision being re-litigated per epic.

**Why this priority**: This is what makes the scaffold match the previously decided repo-structure convention rather than being an arbitrary starting point — getting it right once here avoids every subsequent bounded-context epic needing to create or rename its own folder.

**Independent Test**: Can be fully tested by inspecting the repository's folder tree against the repo-structure decision and confirming each named folder and entry-point file exists, independent of the app actually running.

**Acceptance Scenarios**:

1. **Given** the scaffolded repository, **When** each of the seven bounded-context folders is inspected, **Then** each contains an entry-point file that exports nothing yet (an empty, valid public surface) and compiles without error.
2. **Given** the scaffolded repository, **When** the shared folders are inspected, **Then** all four (database, UI, configuration, logging) are present in the location the architecture decision specifies.

---

### User Story 3 - Rely on working quality gates from day one (Priority: P3)

As the developer, I need type-checking and linting to run cleanly against the empty scaffold, so that the first real pull request into this codebase is validated by gates that are already known-good, rather than a contributor discovering the gates themselves are broken while trying to land unrelated feature work.

**Why this priority**: Lower than booting or the folder structure because a broken gate is a friction point rather than a hard blocker to starting work — but every subsequent epic's pull requests depend on these gates being trustworthy from the first commit.

**Independent Test**: Can be fully tested by running the type-check and lint commands against the scaffold with no feature code added, independent of the dev server running.

**Acceptance Scenarios**:

1. **Given** the scaffolded repository with no feature code added, **When** the type-check command is run, **Then** it completes with zero errors.
2. **Given** the scaffolded repository with no feature code added, **When** the lint command is run, **Then** it completes with zero errors or warnings.

---

### Edge Cases

- What happens when a developer imports a bounded-context folder's entry point before that context has any real functionality implemented? It must resolve to a valid, empty module rather than a build failure, since later epics fill it in incrementally.
- How does the existing `backend/` and `frontend/` layout (and the commands documented for it) get retired without losing the ability to reference the old implementation while porting logic over in later epics? (See Assumptions — resolved by relocating rather than deleting.)
- How does a contributor discover that the new project's command names (install, dev, build, lint, typecheck, test) match what the project's setup documentation expects, without the documentation and the new project drifting out of sync on day one?
- What happens when a developer's local Node.js or package-manager version doesn't match the project's required version? It must fail fast with a clear version-mismatch error at install/dev time, not an unexplained downstream failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST provide a single command that installs all dependencies for the new application.
- **FR-002**: The project MUST provide a single command that starts the application in local development mode with no errors.
- **FR-003**: The project MUST contain one folder per bounded context (Identity & Access, Governance, Prompt Registry, Workflow Orchestration, Billing & Entitlements, Audit & Compliance, Distribution), each with a designated public entry point.
- **FR-004**: Each bounded-context entry point MUST be valid and importable even though it currently exposes no functionality.
- **FR-005**: The project MUST contain the four shared folders (database, UI, configuration, logging) in the location specified by the repo-structure decision.
- **FR-006**: The project MUST enforce strict type-checking across the entire codebase, with no per-file or per-folder opt-out.
- **FR-007**: The project MUST provide a single command that runs static code analysis (linting) across the codebase.
- **FR-008**: The project MUST provide a single command that runs a type-check across the codebase, independent of starting the dev server or building for production.
- **FR-009**: The project's command names (install, dev, build, lint, typecheck, test) MUST be the names this feature's own documentation updates (`CLAUDE.md`, `.claude/anchorstack/project.md`) to reference — the current documentation predates this scaffold and does not yet name these commands, so this feature is responsible for bringing docs and tooling into agreement, not merely preserving an existing match.
- **FR-010**: The resulting folder structure MUST match the previously decided repo-structure document exactly — every named folder present, nothing extraneous that contradicts it.
- **FR-011**: The new application MUST be scaffolded at the repository root, replacing the current split `backend/`/`frontend/` layout as the root-level project — not as a new top-level directory coexisting alongside them (see Assumptions).
- **FR-012**: The project MUST declare its required Node.js and package-manager versions in a machine-enforceable way (not documentation-only), so a mismatched local environment fails fast with a clear version error rather than an unexplained install or build failure.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new contributor can go from a fresh clone to a running local application in under 5 minutes, using only the documented setup commands.
- **SC-002**: 100% of the seven bounded-context locations and four shared locations specified in the architecture decision are present and match it exactly, verified by direct comparison.
- **SC-003**: Type-checking and linting both complete with zero errors on the scaffold before any feature code is added. (Continuing to pass on every subsequent commit depends on CI enforcement, which is a separate, not-yet-scheduled item — see Assumptions.)
- **SC-004**: Every command name referenced in the project's setup documentation (after this feature updates it per FR-009) successfully executes with no "command not found" or configuration error.

## Assumptions

- The seven bounded contexts and four shared folders are exactly those already named in the repo-structure decision (as of the 2026-07-21 clarification session, which added `shared/logging`); no additional or renamed contexts are introduced by this feature.
- "Empty" bounded-context entry points means a barrel file with no exports yet (or an explicit placeholder export), not stub business logic — later epics are responsible for filling in real functionality.
- The test command only needs to run successfully against an empty scaffold (a trivial passing state) — the full test suite and test-database setup described in the testing-strategy decision is out of scope here and lands with the epics that add real logic.
- UI theming/component-library configuration is intentionally not carried forward from the current frontend in this feature — this is a from-scratch scaffold; later UI-focused epics own pulling that configuration forward.
- This feature does not include the module-boundary enforcement rule that blocks a bounded context from importing another's internals in CI — that is a separate, later item. The same later item is also responsible for any ongoing, per-commit CI enforcement of lint/typecheck (SC-003) and of FR-006's "no per-file opt-out" guarantee — this feature only establishes that both pass once, on the empty scaffold.
- The new application replaces `backend/`/`frontend/` at the repository root rather than living in a new top-level directory alongside them, per Requirement 1 of the source backlog item ("replacing the current split `backend/`/`frontend/` layout"). The old code is relocated (e.g. to a `legacy/` folder or a tag/branch), not deleted outright, so it remains available as a reference while later epics port its behavior over — but it no longer occupies the repository root once this feature lands.
