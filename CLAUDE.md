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

<!-- as-retro will add to this over time. -->
