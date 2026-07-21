---
epic: 007-distribution
feature: 004-usage-telemetry
status: open
dependencies: ["002-mcp-server-and-tools.md", "001-rest-api-core-routes.md"]
---

# Usage Telemetry

Port `PromptUsage` recording from the current Python `metrics_service.py`, owned by Distribution per `bcs/distribution/OWNERSHIP.md` — telemetry only, not domain state, safe to roll up or truncate without affecting any bounded context's correctness.

## Requirements

- [ ] `distribution.prompt_usage` table: `id`, `prompt_name`, `prompt_version`, `status_code`, `latency_ms`, `created_at`
- [ ] Recorded for every expansion via both REST (`001-rest-api-core-routes.md`'s expand endpoint) and MCP (`002-mcp-server-and-tools.md`'s `sh-run`) — both transports, matching the parity requirement tenet C1 established for audit logging generally
- [ ] Recorded for every workflow step via `WorkflowRunCompleted`/`WorkflowRunFailed` events
- [ ] Basic metrics endpoint/page (matching current `routers/metrics.py`) surfacing aggregate usage

## Acceptance Criteria

- [ ] An expansion via REST and an equivalent expansion via MCP both produce a `prompt_usage` row — parity between transports verified by test
- [ ] Metrics endpoint returns correctly org-scoped aggregates (no cross-org leakage)

## Open Questions

- None currently.

## Dependencies

- `002-mcp-server-and-tools.md`
- `001-rest-api-core-routes.md`

## Technical Notes

Distinct from Audit & Compliance (epic 003) — this is telemetry for product usage/observability, not the compliance audit trail. Both exist and both matter, but they're owned by different BCs for different reasons (per `bcs/distribution/OWNERSHIP.md` vs `bcs/audit-compliance/OWNERSHIP.md`).
