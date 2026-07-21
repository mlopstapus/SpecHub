# SpecHub

Self-hosted prompt registry distributed via MCP, with hierarchical team/policy/objective governance. Python/FastAPI backend + Next.js/TypeScript frontend + Postgres, deployed via Docker Compose (local) or Helm (Kubernetes).

## Key commands

| Command | Run |
|---------|-----|
| Rebuild | `docker compose up -d` |
| Type check (frontend) | `cd frontend && npx tsc --noEmit` |
| Lint | `cd backend && ruff check .` / `cd frontend && npm run lint` |
| Test (backend) | `cd backend && python -m pytest tests/ -v` |

## Notes

- Backend has no type checker configured (no mypy/pyright); it's slated for a future rewrite in TypeScript.
- Frontend has no test suite configured yet.
- Compliance scope: SOC2, plus NIST alignment (no dedicated automated check yet — review access control, audit logging, and encryption manually).

<!-- as-retro will add to this over time. -->
