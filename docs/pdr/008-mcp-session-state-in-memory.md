# PDR-008: MCP Session State In-Memory Per Process, Pinned by ALB Sticky Sessions

**Status:** Accepted
**Date:** 2026-07-20
**Updated:** 2026-07-20 — hosting platform decided as AWS ([PDR-009](009-aws-hosting-platform.md)), resolving the sticky-sessions-vs-Redis question below in favor of ALB sticky sessions.

## Context

The MCP server caches a resolved `userId` per session (keyed by the MCP connection) to avoid re-validating the API key on every tool call, and tracks whether session context has already been injected once. Today this lives in an in-memory map (`session.py`'s `session_manager`). This is safe on a single process but becomes a correctness problem the moment the managed SaaS runs more than one server instance behind a load balancer without sticky sessions — a request could land on a process that never saw the session's earlier calls.

## Options Considered

### Keep in-memory, require sticky sessions at the load balancer once horizontally scaled
Pros: zero added infrastructure now; MCP session state is genuinely ephemeral (loses nothing but a cache — the next call just re-validates the API key and re-resolves in one extra DB round trip).
Cons: couples future infra to sticky-session load balancing, which has its own operational quirks (uneven load distribution, awkward instance draining on deploy).

### Move to Redis (or similar) for shared session state now
Pros: works correctly under horizontal scaling from day one.
Cons: adds a stateful dependency and an ops burden (another thing to provision, monitor, and back up) before there's any actual multi-instance deployment to justify it — premature for current scale.

## Decision

Keep MCP session state in-memory per process. On AWS ([PDR-009](009-aws-hosting-platform.md)), the ALB is configured with sticky sessions (`AWSALB` cookie) once the SaaS runs more than one ECS/Fargate task, so a given MCP connection keeps landing on the instance that first resolved its session cache. No Redis or other shared session store is introduced.

## Consequences

- **Positive:** no added stateful infrastructure; the design is already safe because session state is a pure optimization, never a source of truth (Identity & Access's `authenticateApiKey` remains the ground truth on every cache miss). ALB sticky sessions are a load-balancer config setting, not a new service to run and operate.
- **Negative:** self-hosted Free-tier installs are single-instance anyway and never hit this. On the SaaS side, sticky sessions mean load isn't perfectly balanced across tasks, and an instance being drained on deploy briefly loses its pinned sessions' cache (graceful — see failure mode below).
- **Risks:** a task restart or deploy drops a pinned session's cache, costing one extra API-key validation round trip per affected session (not data loss or a security issue). Mitigation: none needed beyond what's already true — the cache-miss path was always designed to be safe, per the original decision below.
