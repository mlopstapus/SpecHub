# SpecHub

Self-hosted prompt registry distributed via MCP, with hierarchical team/policy/objective governance. Python/FastAPI backend + Next.js/TypeScript frontend + Postgres, deployed via Docker Compose (local) or Helm (Kubernetes).

## Key commands

| Command | Run |
|---------|-----|
| Rebuild | `docker compose up -d` |
| Type check (frontend) | `cd frontend && npx tsc --noEmit` |
| Lint | `cd backend && ruff check .` / `cd frontend && npm run lint` |
| Test (backend) | `cd backend && uv run pytest tests/ -v` |

## Notes

- Backend has no type checker configured (no mypy/pyright); it's slated for a future rewrite in TypeScript.
- Frontend has no test suite configured yet.
- Compliance scope: SOC2, plus NIST alignment (no dedicated automated check yet — review access control, audit logging, and encryption manually).
- Use `uv run pytest`, not bare `python -m pytest` — deps live in uv's managed venv and `uv run` doesn't require it to be activated first.
- **Every mutating REST route must depend on `get_current_user` (or `require_admin` for admin-only ops).** `apikeys.py` and `prompts.py` were previously missing this entirely (fixed 2026-07-21) — when adding a new router, follow the pattern in `teams.py`/`objectives.py`/`policies.py`, and add ownership checks (self-or-admin) for user-scoped resources like API keys.
- Tests needing to exercise *real* auth (not the mocked-admin `client` fixture in `conftest.py`) should add a local `auth_client` fixture with no dependency overrides for `get_current_user`/`require_admin` — see `test_auth.py`, `test_prompts.py`, or `test_apikeys.py` for the pattern.

<!-- as-retro will add to this over time. -->
