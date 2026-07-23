# Architecture: SkillCanon

**Last updated:** 2026-07-23
**Status:** Proposed

## Overview

SkillCanon is a prompt registry with hierarchical governance, distributed to AI coding tools as native Skills (Claude Code, day one) backed by live REST calls, with MCP kept as a deprioritized secondary protocol ([PDR-010](../docs/pdr/010-skill-based-distribution-not-mcp.md)). IDEs connect directly to a SkillCanon instance and pull governed, versioned prompt templates — SkillCanon never calls an LLM itself. This document covers the target architecture for a full rewrite: unifying the current split Python/FastAPI + Next.js codebase into a single TypeScript application, and building in multi-tenancy, entitlements, and audit logging from day one to support a Free (self-hosted) / Paid (managed SaaS) business model without a later re-architecture.

## Architectural Style

**Modular monolith**: a single Next.js/TypeScript application (pnpm-managed), internally organized into seven bounded contexts (`/bcs/`) that communicate via synchronous in-process function calls, backed by one PostgreSQL database (per-context Postgres schemas for physical ownership clarity). Chosen over microservices or an event-driven architecture because the team is one person, the domain's hardest problems (governance resolution, audit completeness) need strong consistency rather than eventual consistency, and the operational simplicity of one deployable directly serves both the self-hosted OSS use case and a solo-maintained SaaS running on AWS. See [PDR-001](../docs/pdr/001-typescript-unification.md), [PDR-007](../docs/pdr/007-synchronous-in-process-contexts.md), and [PDR-009](../docs/pdr/009-aws-hosting-platform.md).

## Bounded Contexts

| Context | Responsibility | Contract | Ownership |
|---|---|---|---|
| Identity & Access | Tenancy (Organization), Team hierarchy, users, auth, API keys, invitations | [Contract](../bcs/identity-access/CONTRACT.md) | [Ownership](../bcs/identity-access/OWNERSHIP.md) |
| Governance | Policy/Objective hierarchical resolution — core domain | [Contract](../bcs/governance/CONTRACT.md) | [Ownership](../bcs/governance/OWNERSHIP.md) |
| Prompt Registry | Projects, prompts, versions, sharing, template expansion — core domain | [Contract](../bcs/prompt-registry/CONTRACT.md) | [Ownership](../bcs/prompt-registry/OWNERSHIP.md) |
| Workflow Orchestration | Multi-step prompt chains | [Contract](../bcs/workflow-orchestration/CONTRACT.md) | [Ownership](../bcs/workflow-orchestration/OWNERSHIP.md) |
| Billing & Entitlements | Stripe subscriptions, plan defaults, per-org entitlement flags/limits | [Contract](../bcs/billing-entitlements/CONTRACT.md) | [Ownership](../bcs/billing-entitlements/OWNERSHIP.md) |
| Audit & Compliance | Immutable audit log, retention/export | [Contract](../bcs/audit-compliance/CONTRACT.md) | [Ownership](../bcs/audit-compliance/OWNERSHIP.md) |
| Distribution | REST API, Skill Sync CLI (Claude Code), UI composition, MCP protocol server (deprioritized) — the external boundary | [Contract](../bcs/distribution/CONTRACT.md) | [Ownership](../bcs/distribution/OWNERSHIP.md) |

**Context map:**
- Identity & Access is a shared-identifier source for everyone (`organizationId`/`userId`/`teamId` as opaque IDs) — no context reads its tables directly, only its contract functions.
- Prompt Registry → Governance and Workflow Orchestration → Prompt Registry are **customer/supplier** relationships, synchronous, read-heavy.
- Every context → Billing & Entitlements is **customer/supplier**; Billing is the sole **anti-corruption layer** in front of Stripe — no other context imports the Stripe SDK.
- Every context → Audit & Compliance is **customer/supplier**, write-only, transactional (not eventually consistent — see [PDR-005](../docs/pdr/005-audit-logging-core-infrastructure.md)).
- Distribution is a **conformist consumer** of all six other contexts — it has no domain rules of its own, only composition and protocol translation. The primary path is REST — both directly and via the Skill Sync CLI's live calls to the expand route ([PDR-010](../docs/pdr/010-skill-based-distribution-not-mcp.md)); MCP is a deprioritized secondary protocol.

## Data Architecture

| Store | Owner BC | Type | Why |
|---|---|---|---|
| `identity_access.*` | Identity & Access | Postgres schema | Organization, Team, User, Invitation, ApiKey |
| `governance.*` | Governance | Postgres schema | Policy, Objective |
| `prompt_registry.*` | Prompt Registry | Postgres schema | Project, Prompt, PromptVersion, PromptShare |
| `workflow.*` | Workflow Orchestration | Postgres schema | Workflow, WorkflowRun (new — persists run history) |
| `billing.*` | Billing & Entitlements | Postgres schema | Plan, Subscription, Entitlement |
| `audit.*` | Audit & Compliance | Postgres schema | AuditEvent (append-only) |
| `distribution.*` | Distribution | Postgres schema | PromptUsage (telemetry only) |
| MCP session cache | Distribution | In-process memory | Ephemeral optimization only, never a source of truth — see [PDR-008](../docs/pdr/008-mcp-session-state-in-memory.md) |

**Consistency:** strong consistency throughout — one Postgres database, transactional guarantees used deliberately for audit-write atomicity (see PDR-005) and read-fresh (never cached) governance resolution.

**Read/write pattern:** read-heavy overall; the hot path is prompt/workflow expansion — via the REST expand route directly, via the Skill Sync CLI's live call to that same route ([PDR-010](../docs/pdr/010-skill-based-distribution-not-mcp.md)), or via MCP's `sh-run`/`sh-workflow-run` if that path is ever built — which fans out into a Governance resolution call plus recursive prompt-inclusion lookups per request. No caching layer at launch — flagged as a future optimization if expansion latency becomes a problem, not built preemptively. Every path resolves live, never cached, so a policy change takes effect on the very next call regardless of which transport made it.

**Cross-context data flow:** synchronous in-process calls per each BC's CONTRACT.md — see [PDR-007](../docs/pdr/007-synchronous-in-process-contexts.md) for why events/a queue were rejected.

**Multi-tenancy:** every table across every schema carries `organization_id`; uniqueness constraints are `(organization_id, x)`, not global — corrected from today's globally-unique `users.email`/`username` and `prompts.name`. See [PDR-003](../docs/pdr/003-multi-tenancy-day-one.md).

**Migration path:** none needed — pre-launch, no production data. Fresh Drizzle schema and migration history from the first commit; the existing Alembic history is abandoned at cutover.

**Backup and recovery:** self-hosted Free tier is the operator's responsibility (documented recommended `pg_dump`/`pg_basebackup` practice, not managed by SkillCanon itself). The managed SaaS uses a managed Postgres provider with point-in-time recovery (buy, not build — see Build vs Buy below); RPO/RTO targets to be set once a provider is chosen (open question).

## Key Decisions

- [PDR-001: Unify on TypeScript, single Next.js app](../docs/pdr/001-typescript-unification.md)
- [PDR-002: Drizzle as the ORM](../docs/pdr/002-drizzle-orm.md)
- [PDR-003: Organization as an explicit tenant root, from day one](../docs/pdr/003-multi-tenancy-day-one.md)
- [PDR-004: Entitlements as per-org data, not a hardcoded tier enum](../docs/pdr/004-entitlements-as-data.md)
- [PDR-005: Audit logging as core infrastructure from day one](../docs/pdr/005-audit-logging-core-infrastructure.md)
- [PDR-006: Single repo, plan-gated features (not open-core split)](../docs/pdr/006-single-repo-plan-gated.md)
- [PDR-007: Synchronous in-process calls between contexts, not events/queue](../docs/pdr/007-synchronous-in-process-contexts.md)
- [PDR-008: MCP session state in-memory per process, pinned by ALB sticky sessions](../docs/pdr/008-mcp-session-state-in-memory.md)
- [PDR-009: AWS as the managed SaaS hosting platform](../docs/pdr/009-aws-hosting-platform.md)
- [PDR-010: Skill-based prompt distribution via live REST resolution, not MCP](../docs/pdr/010-skill-based-distribution-not-mcp.md)
- [PDR-011: Project linking and roster sync via CLI, SessionStart hook, and hash-based drift detection](../docs/pdr/011-skill-sync-cli-and-drift-detection.md)

## Failure Model

| Component | Failure mode | Blast radius | Degraded behavior |
|---|---|---|---|
| Governance resolver | Query error / bad data | Blocks expansion for that request | **Fails closed** — expansion errors out rather than silently rendering ungoverned output. A missing policy enforcement is a compliance regression, not a UX nuisance. |
| Billing & Entitlements | Stripe outage | None at request time | `resolveEntitlements()` never calls Stripe live — it reads locally mirrored state, refreshed only by webhook. Stripe being down does not degrade the running app at all. |
| Audit write | DB error during the same transaction as a mutation | The mutation itself | **Fails closed by construction** — the audit write happens in the same transaction as the mutation it describes, so either both commit or both roll back. No separate audit-specific failure mode exists. |
| MCP session cache | Process restart | One extra DB round trip for affected sessions | Safe — cache is a pure optimization, re-resolves from the API key on the next call. |
| Prompt Registry expansion (recursive inclusion) | Deep/cyclic inclusion | That expansion request | Bounded by `MAX_INCLUDE_DEPTH`, carried forward unchanged from the current implementation. |

## Integrations

- **Claude Code** (primary, day one) — the `skillcanon` CLI links a repo to a SkillCanon project, syncs a roster of thin Skill stub files, and resolves each one live via the REST expand route on invocation. See [PDR-010](../docs/pdr/010-skill-based-distribution-not-mcp.md), [PDR-011](../docs/pdr/011-skill-sync-cli-and-drift-detection.md), and `backlog/007-distribution/005-skill-sync-cli.md`.
- **MCP clients** (Windsurf, Copilot, any MCP-compatible tool) — deprioritized (see PDR-010); if built, Streamable HTTP, bearer-authenticated via API key, tool surface `sh-list`, `sh-search`, `sh-context`, `sh-run`, `sh-workflow-list`, `sh-workflow-run` unchanged from today's plan.
- **Stripe** — subscriptions, checkout, billing portal, webhooks; isolated entirely behind Billing & Entitlements ([PDR-006](../docs/pdr/006-single-repo-plan-gated.md)).

## Non-Functional Properties

| Property | Target | Notes |
|---|---|---|
| Availability | Self-hosted: operator-managed. SaaS: single-instance acceptable at launch (see [PDR-008](../docs/pdr/008-mcp-session-state-in-memory.md) for the pre-scaling checklist) | No HA target set yet — open question |
| Performance | Expansion (`sh-run`) is the latency-sensitive path — agents call it interactively | No SLO defined yet — open question |
| Security | Multi-tenant isolation enforced by mandatory `organization_id` scoping in every query helper, no cross-context raw table access | See [PDR-003](../docs/pdr/003-multi-tenancy-day-one.md) |
| Compliance | SOC2 + NIST alignment (per CLAUDE.md) | Audit logging now a concrete mechanism, not a manual-review promise — see [PDR-005](../docs/pdr/005-audit-logging-core-infrastructure.md) |

## Build vs Buy

| Capability | Decision | Why |
|---|---|---|
| Auth / identity | Build (bcrypt + JWT/session cookies) | Self-hosted installs shouldn't depend on a third-party auth SaaS for core login; the auth surface is small enough to own |
| Payments | Buy — Stripe | Seat-based billing, checkout, portal, webhooks — no reason to build this |
| Email (invitations, receipts) | Buy — pluggable transactional email provider (e.g. Resend/Postmark) | Self-hosted installs configure their own SMTP/provider credentials; not bundled as a hard dependency |
| Background jobs / queues | Skip for now | No workload yet justifies queue infrastructure; Stripe webhooks and entitlement pruning run as simple route handlers / scheduled jobs, not a queue |
| Search | Skip for now | Prompt list/search is simple SQL filtering at current scale; revisit only if prompt catalogs grow large |
| File storage | N/A | Prompts are text in Postgres; no attachment/file feature planned |
| Error tracking | Buy — Sentry | Cheap, standard, not worth building |
| Feature flags | Build — this is the Entitlements system ([PDR-004](../docs/pdr/004-entitlements-as-data.md)) | Entitlements already solve this; a separate flagging service would duplicate it |
| Managed Postgres (SaaS) | Buy — AWS RDS | Point-in-time recovery and backups are exactly the kind of undifferentiated ops work worth buying — see [PDR-009](../docs/pdr/009-aws-hosting-platform.md) |

## Operational Notes

- Two self-hosted deployment targets remain supported: Docker Compose (local) and Helm/K8s (at scale) — see current [README.md](../README.md) commands, to be updated for the new stack once implementation starts.
- The managed SaaS runs on **AWS**: ECS/Fargate behind an ALB for the app tier, RDS for Postgres — see [PDR-009](../docs/pdr/009-aws-hosting-platform.md). Infra should be defined as code (Terraform or CDK) from the start, not configured manually through the console.
- MCP session state stays in-memory per task; once the SaaS runs more than one ECS task, the ALB is configured for sticky sessions rather than introducing Redis — see [PDR-008](../docs/pdr/008-mcp-session-state-in-memory.md).
- Self-hosted installs always run with billing disabled and Free-tier entitlements hardcoded locally — see the note in [`bcs/billing-entitlements/OWNERSHIP.md`](../bcs/billing-entitlements/OWNERSHIP.md).
- Web UI auth uses a JWT carried in an httpOnly cookie; MCP/API access continues to use separate scoped bearer API keys — see [`bcs/identity-access/CONTRACT.md`](../bcs/identity-access/CONTRACT.md).

## Open Questions

- **AWS account/network topology**: single AWS account vs. separate accounts per environment (dev/staging/prod), VPC layout, and whether RDS is single-AZ or Multi-AZ at launch — not yet decided, worth settling before writing the Terraform/CDK.
- **Availability and performance targets**: no formal SLO/SLA set yet for the SaaS tier — matters once Enterprise deals start asking for uptime commitments.
- **Entitlement key catalog**: the initial Free/Paid default values for each entitlement key (`maxTeams`, `auditRetentionDays`, `seatLimit`, etc.) haven't been set — deliberately deferred per the decision not to lock in tier specifics yet (see [PDR-004](../docs/pdr/004-entitlements-as-data.md)).
- **Existing `docs/architecture.md`** describes the current Python-era system and will be stale once this rewrite lands — recommend replacing it with a pointer to this document once implementation is underway, rather than maintaining two architecture docs in parallel.
- **Skill Sync CLI beyond Claude Code**: the roster-sync mechanism ([PDR-011](../docs/pdr/011-skill-sync-cli-and-drift-detection.md)) is designed to be pluggable per IDE but only the Claude Code adapter is being built now — Copilot/Codex parity is unscheduled.
- **MCP's actual fate**: deprioritized per [PDR-010](../docs/pdr/010-skill-based-distribution-not-mcp.md), not cancelled — whether it's ever built depends on whether a real non-skill-capable MCP client or a workflow-orchestration need for `sh-workflow-run` materializes.
