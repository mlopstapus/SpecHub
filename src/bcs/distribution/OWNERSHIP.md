# Distribution — Ownership

**Owner:** Ben Anderson

## Folder Ownership

| Path | Ownership level |
|---|---|
| `/bcs/distribution/` | Full |
| `src/app/api/**` (REST routes) | Full |
| `src/app/mcp/**` (MCP server, tool handlers, session state) | Full |
| `src/app/(app)/**`, `src/app/(auth)/**` (page shells, layout composition) | Full — individual context UIs listed in each BC's own OWNERSHIP.md are embedded here but authored by their owning BC |
| `/shared/` (see below) | Full |

## Database Ownership

Postgres schema: `distribution`

| Schema / Table | Notes |
|---|---|
| `distribution.prompt_usage` | Telemetry only — status code, latency, prompt/version, timestamp. Not domain state; safe to truncate/roll up without affecting any bounded context's correctness |

## Shared Resource Ownership

Files in `/shared/` are cross-cutting infrastructure with no business-domain meaning of their own, so they're claimed here rather than split across contexts:

| Resource | Path | Notes |
|---|---|---|
| Drizzle client, connection pool, transaction wrapper | `/shared/db/` | The `withAudit()` transactional wrapper used by every context to guarantee audit writes land atomically lives here, calling into Audit & Compliance's `record()` |
| Design system components (shadcn-based) | `/shared/ui/` | Presentational only, no domain logic |
| Env/config loading | `/shared/config/` | |
| MCP session state (in-memory, per-process) | `src/app/mcp/session.ts` | Ephemeral cache only — never a source of truth; safe to lose on restart |

## Dependencies (owned by others)

| Resource | Owned by BC |
|---|---|
| Everything — this context calls every other context's exposed API | All |
