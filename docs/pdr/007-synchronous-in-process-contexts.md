# PDR-007: Synchronous In-Process Calls Between Bounded Contexts, Not Events/Queue

**Status:** Accepted
**Date:** 2026-07-20

## Context

Seven bounded contexts (Identity & Access, Governance, Prompt Registry, Workflow Orchestration, Billing & Entitlements, Audit & Compliance, Distribution) need to communicate. The system is a single modular monolith, one Postgres database, one Next.js deployment, solo-maintained, pre-launch scale.

## Options Considered

### Event bus / message queue between contexts
Contexts publish domain events; other contexts subscribe and react asynchronously.
Pros: strong decoupling, natural fit if contexts are ever split into separate deployables.
Cons: eventual consistency is actively wrong for the two things that matter most here — policy resolution must reflect the current state at call time (a stale cached policy silently applied is a compliance bug, not a UX nuisance), and audit writes must not be separable from the mutation they describe (an audit event lost in a queue after its mutation already committed is exactly the gap this system exists to prevent, see PDR-005). Also meaningfully more operational surface (a broker, retry/dead-letter handling) for a solo maintainer to run.

### Synchronous in-process function calls, per each BC's CONTRACT.md
Contexts call each other's exposed application-service functions directly, within the same request/transaction where correctness demands it (e.g. audit writes).

## Decision

Synchronous in-process calls for everything. Contexts still publish named domain events (see each CONTRACT.md's "Events Published" table) for documentation and future extensibility, but nothing currently subscribes to them asynchronously — they describe what happened, primarily for the Audit context's benefit, recorded inline rather than delivered via a bus.

## Consequences

- **Positive:** simplest possible operational model (one process, one database, no broker); strong consistency exactly where it's needed (governance resolution, audit completeness); easy to reason about and debug for a solo maintainer.
- **Negative:** contexts can't be scaled or deployed independently without a real refactor later; a slow call in one context (e.g. Governance resolution under heavy hierarchy depth) directly adds latency to its caller with no async buffer.
- **Risks:** if SaaS usage grows to where one context (most likely Prompt Registry's expansion path) needs independent scaling, this decision will need revisiting. Not a concern at current scale — flagged as an open question in architecture.md rather than solved preemptively.
