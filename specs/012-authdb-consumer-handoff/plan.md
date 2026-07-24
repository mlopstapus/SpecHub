# Implementation Plan: AuthDB Consumer Handoff

**Branch**: `012-authdb-consumer-handoff` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-authdb-consumer-handoff/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Make sure the one real fact this feature depends on — which of the six identity-access functions (`login`, `authenticateSession`, `authenticateApiKey`, `acceptInvitation`, `logout`, org-bootstrap) require the `authDb`-scoped connection instead of the ordinary tenant-scoped one — is captured as a single, explicit, reviewer-usable reference rather than left scattered across per-row `CONTRACT.md` notes that a reviewer has to reassemble by hand. `007-tenant-isolation-tests-and-rls` (delivered as `specs/011-tenant-isolation-rls`) already implemented `authDb`, the `skillcanon_auth` role, and those per-row notes; `backlog/008-distribution/001-rest-api-core-routes.md` and `002-mcp-server-and-tools.md` already carry tracking notes pointing back at this item. What's missing is a consolidated checklist section any reviewer can check a PR against directly, and explicit standalone coverage of `logout`'s non-obvious indirect dependency — both real, small documentation deliverables, not new application code (no Distribution route/tool exists yet for this feature to touch).

## Technical Context

**Language/Version**: N/A — documentation-only change (Markdown)

**Primary Dependencies**: N/A

**Storage**: N/A (this feature does not touch schema, migrations, or the `skillcanon_auth`/`skillcanon_app` roles — those already exist, delivered by `011-tenant-isolation-rls`)

**Testing**: N/A — no application code is added; verification is a documentation completeness check (see quickstart.md), consistent with this repo's existing precedent that the analogous "new tenant-scoped table needs RLS" review has no automated test either

**Target Platform**: Repository documentation — `src/bcs/identity-access/CONTRACT.md` and the two already-annotated `backlog/008-distribution/*.md` files

**Project Type**: Documentation / engineering-governance artifact (not a code feature)

**Performance Goals**: N/A

**Constraints**: Must not change any function's actual behavior, signature, or connection requirement — only make the existing, already-correct requirement easier to verify at review time. Must not duplicate `CONTRACT.md`'s per-row notes in a way that can drift out of sync with them.

**Scale/Scope**: One bounded context's contract doc (`src/bcs/identity-access/CONTRACT.md`), verification of two already-existing backlog tracking notes. No `008-distribution` code exists yet for this feature to modify.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First Development** — N/A. No production logic is added; nothing to red-green.
- **II. Domain-Driven Bounded Contexts** — Compliant. This feature only clarifies an existing contract (`CONTRACT.md`) for identity-access; it does not add cross-context imports or new coupling.
- **III. Domain Invariants Live in the Domain Layer** — N/A. No new invariant is introduced; the six-function connection requirement already exists and already lives in `CONTRACT.md`, not in a handler.
- **IV. Multi-Tenant Isolation by Default** `[M1-M3]` — Directly supports this principle: the whole point of this feature is making sure the RLS backstop (`011-tenant-isolation-rls`) is actually used correctly by its first real consumer. No new tenant-scoped table is added, so no new RLS/negative-test obligation is created by this feature itself.
- **V. Secure by Default** — Supports it; no change to secret handling.
- **VI. Auditable & Compliant (SOC2)** — N/A. No new mutation or transport is added.
- **VII. Feature-Gated by Entitlement** `[G1]` — N/A for this feature itself (it adds no REST route, MCP tool, or UI surface — those come later, from `008-distribution`, and will need their own entitlement gate at that time, tracked separately in that epic).

**Result**: PASS. No violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-authdb-consumer-handoff/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command) — reviewer verification guide
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`data-model.md` and `contracts/` are intentionally omitted — this feature introduces no entities and no new external interface. Its one real "contract" artifact is the consolidated checklist section added directly to the existing `src/bcs/identity-access/CONTRACT.md`, which is where downstream consumers already look (see Phase 1 below).

### Source Code (repository root)

No new source directories. The only files this feature touches:

```text
src/bcs/identity-access/CONTRACT.md   # add a consolidated "Connection Requirements" checklist section
backlog/008-distribution/001-rest-api-core-routes.md   # verify existing tracking note is accurate (no change expected)
backlog/008-distribution/002-mcp-server-and-tools.md   # verify existing tracking note is accurate (no change expected)
```

**Structure Decision**: Single documentation change inside the existing `identity-access` bounded context's contract file, plus a verification pass (no edit expected) over the two already-annotated `008-distribution` backlog items. No `tests/`, `src/models`, or web-app split applies — this is not a code feature.

## Complexity Tracking

> Not applicable — Constitution Check has no violations to justify.
