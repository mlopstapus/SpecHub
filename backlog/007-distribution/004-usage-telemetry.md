---
epic: 007-distribution
feature: 004-usage-telemetry
status: open
dependencies: ["001-rest-api-core-routes.md"]
---

# Usage Telemetry

Port `PromptUsage` recording from the current Python `metrics_service.py`, owned by Distribution per `bcs/distribution/OWNERSHIP.md` — telemetry only, not domain state, safe to roll up or truncate without affecting any bounded context's correctness.

## Requirements

- [ ] `distribution.prompt_usage` table: `id`, `prompt_name`, `prompt_version`, `status_code`, `latency_ms`, `created_at`
- [ ] Recorded for every expansion via REST (`001-rest-api-core-routes.md`'s expand endpoint) — this is also the transport `005-skill-sync-cli.md`'s `skillcanon run` uses, so skill-sync invocations get telemetry for free with no separate wiring
- [ ] If/when `002-mcp-server-and-tools.md` (currently deprioritized) is built, its `sh-run` must record the same way — parity across whichever transports actually exist, matching the parity requirement tenet C1 established for audit logging generally
- [ ] Recorded for every workflow step via `WorkflowRunCompleted`/`WorkflowRunFailed` events
- [ ] Basic metrics endpoint/page (matching current `routers/metrics.py`) surfacing aggregate usage

## Acceptance Criteria

- [ ] An expansion via REST (including via `skillcanon run`) produces a `prompt_usage` row
- [ ] Metrics endpoint returns correctly org-scoped aggregates (no cross-org leakage)
- [ ] If `002-mcp-server-and-tools.md` is later built, its `sh-run` produces an equivalent row — parity between transports verified by test at that time, not required now

## Open Questions

- None currently.

## Dependencies

- `001-rest-api-core-routes.md`

## Technical Notes

Distinct from Audit & Compliance (epic 003) — this is telemetry for product usage/observability, not the compliance audit trail. Both exist and both matter, but they're owned by different BCs for different reasons (per `bcs/distribution/OWNERSHIP.md` vs `bcs/audit-compliance/OWNERSHIP.md`).
