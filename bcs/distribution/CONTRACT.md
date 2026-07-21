# Distribution — Contract

**Owner:** Ben Anderson
**Status:** Draft

## Purpose

The interface/adapter layer — REST route handlers, the MCP protocol server (`sh-list`, `sh-search`, `sh-context`, `sh-run`, `sh-workflow-list`, `sh-workflow-run`), and the web UI's server actions. Has no domain rules of its own: it authenticates the caller (via Identity), resolves the org/user/project context, calls the appropriate domain context's application service, formats the response for HTTP or MCP, and records usage telemetry. Every other context is a supplier to this one; this context supplies nothing back except the composed external surface.

## Exposed APIs

This is the system's actual external boundary — everything below is public:

| Surface | Description |
|---|---|
| REST API (`/api/v1/...`) | Full CRUD over teams, projects, prompts, policies, objectives, workflows, api-keys — used by the web UI |
| MCP endpoint (`/mcp`) | Streamable HTTP MCP server, bearer-authenticated via API key, tools listed above |
| Web UI (`/app/...`) | Next.js pages, session-cookie authenticated |

## Events Published

None domain-relevant — this context terminates event chains rather than starting them (it triggers writes in other contexts, which publish their own events).

## Events Consumed

| Event | From BC | What this BC does with it |
|---|---|---|
| `PromptExpanded` | Prompt Registry | Writes a `PromptUsage` telemetry row (status, latency, prompt/version) |
| `WorkflowRunCompleted` / `WorkflowRunFailed` | Workflow Orchestration | Writes `PromptUsage` rows per step |

## Data Contracts

MCP tool request/response shapes match the current tool set 1:1 (`sh-list`, `sh-search`, `sh-context`, `sh-run`, `sh-workflow-list`, `sh-workflow-run`) — this is a deliberate compatibility guarantee, since existing IDE configs point at these tool names.

## Stability Guarantees

MCP tool names and argument shapes are a public contract to every connected IDE; changing them is a breaking change to every user's existing MCP config, not just an internal refactor.

## Breaking Change Policy

Any MCP tool rename/signature change requires a deprecation window (old tool continues working, logs a warning) before removal, and a PDR.
