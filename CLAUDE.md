# SpecHub

Self-hosted prompt registry distributed via MCP, with hierarchical team/policy/objective governance. A unified Next.js/TypeScript application (pnpm-managed, `src/`) is being built at the repository root per `context/repo-structure.md`, replacing the previous split Python/FastAPI + Next.js layout; the still-functional previous implementation is preserved under `legacy/backend/` and `legacy/frontend/` while later epics port its behavior over. Postgres, deployed via Docker Compose (local) or Helm (Kubernetes).

## Key commands

| Command | Run |
|---------|-----|
| Install | `pnpm install` |
| Dev | `pnpm dev` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Type check | `pnpm typecheck` |
| Test | `pnpm test` |
| Rebuild (self-hosted stack) | `docker compose up -d` |

## Notes

- The commands above run against the new root-level scaffold, which currently has no business logic (empty bounded-context barrels — see `context/repo-structure.md`). Real functionality is ported over epic by epic from `legacy/backend/` and `legacy/frontend/`.
- `docker compose up -d` still builds and runs the legacy app (`legacy/backend/`, `legacy/frontend/`) — it has not yet been repointed at the new scaffold, since the new scaffold has nothing to serve yet.
- Legacy backend has no type checker configured (no mypy/pyright); it was already slated for the TypeScript rewrite now underway.
- Legacy frontend has no test suite configured.
- Compliance scope: SOC2, plus NIST alignment (no dedicated automated check yet — review access control, audit logging, and encryption manually).
- Legacy backend tests: `cd legacy/backend && uv run pytest tests/ -v` (use `uv run`, not bare `python -m pytest` — deps live in uv's managed venv). If pytest/pytest-asyncio are missing, run `uv sync --extra dev` first — bare `uv sync` only installs the base dependency group, not the `dev` optional-dependency group.
- ESLint config uses the new flat-config format (`eslint.config.mjs`) importing `eslint-config-next`'s default export directly — **do not** use the `FlatCompat` shim with the legacy `"next/core-web-vitals"`/`"next/typescript"` string names; `eslint-config-next@16` already ships a native flat array and wrapping it in `FlatCompat` causes a circular-JSON crash.
- Pin `eslint@^9` and `typescript@^5` explicitly in the new scaffold, not `"latest"` — `eslint-config-next`'s `typescript-eslint`/plugin peer deps don't yet support `eslint@10`/`typescript@7`.
- When relocating a top-level directory in this repo (as happened moving `backend/`→`legacy/backend/`, `frontend/`→`legacy/frontend/`), check `docker-compose.yaml` build paths, `.gitignore`/`.dockerignore`, and `CLAUDE.md`/`.claude/anchorstack/project.md`/`README.md` for stale references — none of these update themselves.
- **Every mutating REST route must depend on `get_current_user` (or `require_admin` for admin-only ops).** `apikeys.py` and `prompts.py` were previously missing this entirely (fixed 2026-07-21) — when adding a new router, follow the pattern in `teams.py`/`objectives.py`/`policies.py`, and add ownership checks (self-or-admin) for user-scoped resources like API keys.
- Tests needing to exercise *real* auth (not the mocked-admin `client` fixture in `conftest.py`) should add a local `auth_client` fixture with no dependency overrides for `get_current_user`/`require_admin` — see `test_auth.py`, `test_prompts.py`, or `test_apikeys.py` for the pattern.
- `drizzle-kit`'s `pushSchema()` (from `drizzle-kit/api`) calls `process.exit()` internally when stdout/stdin isn't a TTY — it's built for the interactive `drizzle-kit push` CLI, not for programmatic use inside a test runner (kills the vitest worker outright). For Testcontainers-backed schema/column tests, use the non-interactive pair `generateDrizzleJson(imports, prevId, schemaFilters)` + `generateMigration(prev, cur)` (also from `drizzle-kit/api`) to get plain SQL statements, then execute them directly — see `src/shared/db/columns.test.ts`.
- RLS session context is set via `select set_config('app.current_org_id', $1, true)`, never a literal `SET LOCAL ... = $1` — Postgres's `SET` command doesn't accept bind parameters. See `context/database-conventions.md` and `src/shared/db/tenant-context.ts`.
- Completed backlog items get moved into `backlog/<epic>/archive/` (not just `status: done` flipped in place) — matches the convention already used for `backlog/000-foundations/archive/`. If an item's own Acceptance Criteria aren't all met yet (e.g. one is blocked on a separate not-yet-built backlog item), leave `status: open` and don't archive it — check off only what's actually true, don't force-complete.
- `eslint-plugin-boundaries` (added in epic 001's `003-module-boundary-lint-enforcement`) has real, non-obvious v7 gotchas — verify against the installed version's actual behavior (not just docs) before trusting a config:
  - `boundaries/entry-point` and `boundaries/element-types` are **deprecated** aliases in v7; use the canonical `boundaries/dependencies` rule with a `policies` array instead.
  - Element patterns must **not** include a trailing `**` (e.g. `src/bcs/*`, not `src/bcs/*/**`) — `partialMatch` (default `true`) already expands folder patterns internally, and an explicit `**` double-appends a wildcard, shifting the matched "element path" down into each subdirectory and breaking same-context (`dependency.relationship.to === "internal"`) detection.
  - The rule silently skips analyzing imports from any file that is *both* `element.isUnknown` and `file.isUnknown` — every top-level source directory that should be enforced (e.g. `src/app/`) needs its own `boundaries/elements` entry, even if no policy ever references it directly by type.
  - Import target resolution is real filesystem resolution (`eslint-import-resolver-node`); a nonexistent/purely-virtual import target is silently unclassified and produces zero diagnostics. Fixture tests need a real (even if transient, written-then-deleted) target file on disk — only the *importing* file's content can be pure in-memory text via `ESLint.lintText()`'s `filePath` option.
  - `ESLINT_PLUGIN_BOUNDARIES_DEBUG=1` prints the plugin's exact entity/dependency classification per import — the fastest way to debug an unexpected pass/fail.
- Speckit's `/speckit-specify` does not create a git branch in this repo (no `hooks.before_specify` registered in `.specify/extensions.yml`) — implementation work from `/speckit-implement` lands directly on whatever branch is checked out. Create the feature branch manually before `/speckit-implement` (or at latest before `as-finish`/`as-sync`) rather than letting substantial work accumulate uncommitted on `main`.
- `as-finish`'s Docker-rebuild step is a no-op-in-spirit for most epic-001 work so far: `docker compose up -d` still only builds/runs `legacy/backend`, `legacy/frontend`, and Postgres (see the note above) — skip that step unless the branch's diff actually touches `legacy/backend/`, `legacy/frontend/`, `database/`, or `docker-compose.yaml`.

<!-- as-retro will add to this over time. -->
