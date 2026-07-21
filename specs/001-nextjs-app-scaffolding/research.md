# Phase 0 Research: Next.js App Scaffolding

Every decision below was already made in a prior foundations pass (`backlog/000-foundations/`, archived) or in this feature's own clarification session — there are no open unknowns left to research from scratch. This document consolidates those decisions into the form Phase 1 design builds on, and states scope judgment calls made while translating "empty scaffold" into concrete file contents.

## Framework & language

- **Decision**: Next.js (App Router), TypeScript in strict mode project-wide.
- **Rationale**: PDR-001 (unify on TypeScript, single Next.js app) and `context/repo-structure.md`'s `src/app/` tree.
- **Alternatives considered**: None re-litigated here — this was decided at the architecture level, not per-feature.

## Package manager & version pinning

- **Decision**: pnpm, with the required Node.js and pnpm versions declared via `package.json`'s `engines` field and the `packageManager` field (Corepack-compatible), not documentation-only. The exact Node major version MUST be confirmed against whatever is the current Active LTS at implementation time — not hard-coded from this document, which may go stale.
- **Rationale**: The backlog item names pnpm explicitly. The version-pinning mechanism was this feature's second clarification: machine-enforceable pinning was chosen over docs-only so a mismatched local environment fails fast (FR-012) rather than producing a confusing downstream error, and so CI and local dev can't silently drift onto different toolchain versions.
- **Alternatives considered**: Docs-only version notes in a README — rejected because it doesn't fail fast, and reproducibility (SC-001's 5-minute clone-to-running claim) depends on the toolchain actually matching, not just being written down somewhere.

## Bounded-context folder & barrel pattern

- **Decision**: `src/bcs/<name>/index.ts` per bounded context, exporting nothing yet; `domain/`, `application/`, `infrastructure/` subfolders present but empty.
- **Rationale**: `context/repo-structure.md`'s decided tree (from foundations item 001).
- **Alternatives considered**: None — this is a direct implementation of an already-decided document, not a new choice.

## Shared folders, including the newly added `shared/logging`

- **Decision**: Four `shared/` folders — `db`, `ui`, `config`, `logging` — each a placeholder at this stage. `shared/logging` gets the same treatment as the other three: the folder and an entry point exist, but the full pino-based logger with the secret-redaction serializer described in `context/api-conventions.md` is **not** implemented in this feature.
- **Rationale**: This feature's first clarification resolved that `shared/logging` belongs in scope (closing the gap between `repo-structure.md` and `api-conventions.md`). But the *presence* of the folder is what closes that gap — none of the other shared folders (`db`, `ui`, `config`) get real functional wiring in this feature either (no live DB connection, no shared components yet), so treating `logging` identically keeps the scaffold internally consistent: every shared folder is a placeholder until the epic that actually needs it fills it in. Building the full redaction-serializer now would be speculative — there's no log-emitting code anywhere in the scaffold yet for it to protect.
- **Alternatives considered**: Fully implementing `shared/logging` (real pino instance, `getLogger()`, redaction config) in this feature — rejected as scope creep past "empty scaffold"; deferred to whichever epic first has a route handler or BC service that needs to log something.

## Testing setup

- **Decision**: Vitest is the declared test runner (`context/testing-strategy.md`), but this feature only needs `pnpm test` to execute successfully against a trivial passing state — no real test suite, no Testcontainers/Postgres wiring.
- **Rationale**: Spec Assumptions explicitly scope the test-database strategy to later epics that add real logic.
- **Alternatives considered**: Skipping the `test` script entirely — rejected because FR-009/SC-004 require every documented command name to actually execute without a "command not found" error, and `test` is one of the names `CLAUDE.md` references.

## Lint & format tooling

- **Decision**: ESLint (flat config, `eslint.config.mjs`, matching current Next.js defaults) + Prettier, matching or improving on the current frontend's `.eslintrc.json` per the backlog item's technical notes.
- **Rationale**: Backlog item requirement; flat config is the current Next.js/ESLint default and avoids scaffolding an already-deprecated config format.
- **Alternatives considered**: Carrying forward the legacy `.eslintrc.json` format unchanged — rejected per the backlog item's own instruction to match *or improve on* the current config, and flat config is the forward-compatible choice.

## Relocating the old backend/frontend

- **Decision**: `backend/` → `legacy/backend/`, `frontend/` → `legacy/frontend/` (via `git mv`, preserving history), not deleted.
- **Rationale**: This feature's spec Assumption, itself derived from the backlog item's Requirement 1 ("replacing the current split `backend/`/`frontend/` layout") — the new app needs the repository root unambiguously, but later epics still need to reference old behavior while porting it (characterization tests per `context/testing-strategy.md`).
- **Alternatives considered**: Deleting outright — rejected, loses the reference needed for the Python-to-TS characterization-test porting strategy already decided in `context/testing-strategy.md`. Keeping at the root alongside the new app — rejected per FR-011 (the clarified requirement that the new app owns the root).

## Module-boundary lint enforcement

- **Decision**: Out of scope for this feature.
- **Rationale**: Explicitly named as a separate, later backlog item (`module-boundary-lint-enforcement`) in both the source ticket and `context/repo-structure.md`'s "Consumed by" section.
- **Alternatives considered**: N/A — this is a scope boundary, not a technical choice.
