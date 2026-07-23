# PDR-001: Unify on TypeScript, Single Next.js App

**Status:** Accepted
**Date:** 2026-07-20

## Context

SkillCanon is currently split across a Python/FastAPI backend (SQLAlchemy, Alembic, no type checker configured) and a Next.js/TypeScript frontend. Backend and MCP server run as a separate process from the frontend. CLAUDE.md already flags the backend as "slated for a future rewrite in TypeScript." The project is pre-launch with no production data, and is maintained solo, with a stated goal of end-to-end type safety and a single language to own.

## Options Considered

### Keep two languages, add a Python type checker
Add mypy/pyright to the existing backend, keep the split.
Pros: least short-term work, no rewrite risk.
Cons: doesn't address the stated goal (one language), context-switching cost remains permanently, doesn't help hiring/contributor pool for an OSS project.

### Rewrite backend in TypeScript, keep it a separate service from the frontend
Two TS services (API/MCP service + Next.js frontend), closer to today's two-process shape.
Pros: keeps a clean process boundary, could scale independently later.
Cons: more moving parts to operate for a solo maintainer; no real benefit at current scale over a unified app.

### Rewrite as a single unified Next.js app
Route handlers serve REST, the MCP endpoint, and the UI from one deployable.
Pros: one language, one deployable, one test suite, one Docker image, simplest possible ops story for a solo maintainer.
Cons: less separation of concerns at the process level (mitigated by enforcing module/BC boundaries in code, not processes).

## Decision

Rewrite as a single unified Next.js/TypeScript application, using the bounded contexts in `/bcs/` to enforce internal separation instead of process separation.

## Consequences

- **Positive:** one language, one type system spanning DB → API → UI, one deployable to build/test/ship, lower operational surface for a solo maintainer.
- **Negative:** the whole backend is a from-scratch rewrite, not an incremental port — real risk of behavior drift from the current Python implementation, especially in the policy/objective resolution and prompt-inclusion logic.
- **Risks:** silent correctness regressions in governance resolution. Mitigation: write characterization tests against the current Python behavior before porting (see project testing approach), and treat the resolver as the highest-priority component for TDD coverage.
