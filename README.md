# PCP — Prompt Control Plane

An open-source, self-hosted prompt registry with **hierarchical governance**, distributed via [MCP (Model Context Protocol)](https://modelcontextprotocol.io/).

Define prompts once, distribute them to every developer's AI tool (Claude, Windsurf, Copilot) as `pcp-*` MCP tools. Enforce organizational policies and objectives automatically during prompt expansion. PCP never calls an LLM — it serves expanded prompts, and the IDE's own LLM does the work.

## Key Features

- **Prompt Registry** — versioned Jinja2 templates with input schemas, tags, and deprecation
- **MCP Distribution** — every prompt becomes a `pcp-{name}` tool accessible from any MCP-compatible IDE
- **Hierarchical Teams** — recursive team tree with users, enabling org-wide governance
- **Policy Enforcement** — policies (prepend/append/inject) are automatically applied during prompt expansion
- **Objective Tracking** — team and user objectives are surfaced alongside expanded prompts
- **Two-Layer Inheritance** — inherited (immutable from parent teams) + local (mutable at your level)
- **Projects** — team-owned with cross-team members, layering additional policies/objectives
- **User-Scoped API Keys** — authentication tied to users, not projects
- **Workflows** — multi-step prompt pipelines
- **Admin Dashboard** — Next.js frontend for managing teams, prompts, policies, and more

## Quickstart (docker-compose)

```bash
git clone <repo> && cd pcp
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install -e ".[dev]"

# Start Postgres
docker-compose up -d postgres

# Run migrations and seed example prompts
alembic upgrade head
python scripts/seed.py

# Start the server
uvicorn src.pcp_server.main:app --reload --port 8000
```

- **REST API:** http://localhost:8000/api/v1/prompts
- **MCP endpoint:** http://localhost:8000/mcp/
- **OpenAPI docs:** http://localhost:8000/docs
- **Health check:** http://localhost:8000/health
- **Frontend:** http://localhost:3000 (run `cd frontend && npm run dev`)

## Deploy with Helm (Kubernetes)

```bash
# Add a PostgreSQL instance (e.g. Bitnami)
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install pcp-postgresql bitnami/postgresql \
  --set auth.username=pcp \
  --set auth.password=pcp \
  --set auth.database=pcp

# Install PCP
helm install pcp charts/pcp \
  --set postgresql.host=pcp-postgresql \
  --set postgresql.password=pcp \
  --set authToken=my-secret-token

# Verify
kubectl get pods -l app.kubernetes.io/name=pcp
kubectl port-forward svc/pcp 8000:8000
curl http://localhost:8000/health
```

See [`charts/pcp/values.yaml`](charts/pcp/values.yaml) for all configuration options.

## Connect Your AI Tool

### Windsurf

Open MCP settings (⌘+Shift+P → "MCP: Configure MCP Servers") and add:

```json
{
  "mcpServers": {
    "pcp": {
      "serverUrl": "http://localhost:8000/mcp/"
    }
  }
}
```

### Claude Code

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pcp": {
      "transport": "sse",
      "url": "http://localhost:8000/mcp/"
    }
  }
}
```

### GitHub Copilot

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "pcp": {
      "url": "http://localhost:8000/mcp/"
    }
  }
}
```

Once connected, you get these tools automatically:

**Entrypoints** — start here:

| Tool | Description |
|------|-------------|
| `pcp-new` | Start a new feature or task — plans, implements, tests, and iterates with user feedback |
| `pcp-finish` | Finalize work — run tests, document, commit, review, and improve prompts |

**Building blocks** — used by the entrypoints, or individually for targeted work:

| Tool | Description |
|------|-------------|
| `pcp-plan` | Generate a structured implementation plan |
| `pcp-feature` | Implement a new feature |
| `pcp-iterate` | Incrementally improve existing code based on feedback |
| `pcp-fix` | Diagnose and fix a bug or error |
| `pcp-refactor` | Restructure code without changing behavior |
| `pcp-test` | Generate tests for code |
| `pcp-review` | Perform a thorough code review |
| `pcp-document` | Generate documentation |
| `pcp-commit` | Commit changes to the repository |
| `pcp-ralph` | Iteratively improve PCP prompts based on session takeaways |
| `pcp-list` | List all available prompts |
| `pcp-search` | Search prompts by name or tag |
| `pcp-context` | Show effective policies and objectives for the current user |

All prompt tools accept an optional `project` parameter (UUID) to layer project-specific policies and objectives on top of the team hierarchy.

## Governance Model

PCP uses a recursive team hierarchy for governance:

```
Org (root team)
├── Engineering (child team)
│   ├── MLOps (grandchild team)
│   │   └── alice, bob (users)
│   └── carol (user)
└── Design (child team)
    └── dave (user)
```

**Policies** cascade down the tree. When Alice expands a prompt:
1. Org policies → inherited (immutable)
2. Engineering policies → inherited (immutable)
3. MLOps policies → local (mutable)
4. If a project is specified → project policies added to local

**Objectives** follow the same pattern — inherited from above, appendable at your level.

The expand response includes `applied_policies` and `objectives` so the AI tool (and user) can see exactly what governance was applied.

## API Examples

**Create a team and user:**

```bash
# Create a team
curl -X POST http://localhost:8000/api/v1/teams \
  -H "Content-Type: application/json" \
  -d '{"name": "Engineering", "slug": "engineering"}'

# Create a user in that team
curl -X POST http://localhost:8000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "team_id": "<team-id>"}'
```

**Create a policy:**

```bash
curl -X POST http://localhost:8000/api/v1/policies \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": "<team-id>",
    "name": "always-test",
    "enforcement_type": "append",
    "content": "Always include unit tests for new code.",
    "priority": 10
  }'
```

**Create a prompt:**

```bash
curl -X POST http://localhost:8000/api/v1/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-prompt",
    "description": "A custom prompt",
    "user_id": "<user-id>",
    "version": {
      "version": "1.0.0",
      "system_template": "You are a helpful assistant.",
      "user_template": "Help me with: {{ input }}",
      "tags": ["general"]
    }
  }'
```

**Expand a prompt (with policy enforcement):**

```bash
curl -X POST http://localhost:8000/api/v1/expand/my-prompt \
  -H "Content-Type: application/json" \
  -d '{"input": {"input": "building a REST API"}}'
```

Response includes `applied_policies` and `objectives` alongside the expanded messages.

**View effective policies for a user:**

```bash
curl "http://localhost:8000/api/v1/policies/effective?user_id=<user-id>"
```

Returns `{ "inherited": [...], "local": [...] }`.

## How It Works

1. Admin creates teams, users, policies, and objectives via REST API or the admin dashboard
2. Admin creates prompts via REST API (or seed script from YAML files in `prompts/`)
3. PCP dynamically registers each prompt as a `pcp-{name}` MCP tool
4. Developers connect their AI tool to PCP's MCP endpoint
5. Developer invokes `pcp-plan build a feature store`
6. PCP resolves the user's effective policies and objectives from the team chain
7. PCP applies policy enforcement (prepend/append/inject) to the templates
8. PCP expands Jinja2 templates → returns `system_message` + `user_message` + `applied_policies` + `objectives`
9. The IDE's own LLM uses the returned prompt to generate the response

## Prompt Composition

Prompts can include other prompts using `include_prompt()` in their Jinja2 templates. This lets a prompt pull in context from other prompts at expansion time.

```yaml
user_template: >
  Plan this feature: {{ input }}

  Consider the review perspective:
  {{ include_prompt('review') }}
```

When expanded, `include_prompt('review')` fetches the `review` prompt, renders its system + user templates with the same input variables, and inlines the result.

- **Nested includes** are supported (A includes B includes C)
- **Max depth of 3** prevents infinite recursion
- **Missing prompts** return a safe error marker instead of failing

## Running Tests

```bash
python -m pytest tests/ -v
```

64 tests covering prompt CRUD, expansion, policy enforcement, team hierarchy resolution, objective inheritance, project members, user-scoped API keys, and workflows.

## Tech Stack

- **Python 3.12+**, FastAPI, SQLAlchemy 2.0 (async), Alembic
- **PostgreSQL** for storage
- **Jinja2** (sandboxed) for template expansion
- **MCP Python SDK** for MCP server (Streamable HTTP transport)
- **Next.js 14**, TailwindCSS, shadcn/ui for the admin dashboard
- **Helm 3** for Kubernetes deployment
- **GitHub Actions** for CI (lint, test, build, helm lint)

## Documentation

- [Architecture & Design](docs/architecture.md)
- [Deploy to OpenShift CRC](docs/deploy-openshift-crc.md)

## License

Apache 2.0 — see [LICENSE](LICENSE)