# Implementation Plan: Module Boundary Lint Enforcement

**Branch**: `003-module-boundary-lint-enforcement` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-module-boundary-lint-enforcement/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Turn tenet D1 ("bounded contexts own their models; no context reaches into another's internals directly") into a build-breaking ESLint rule. Every bounded context under `src/bcs/<name>/` gets a generic, capture-group-based boundary rule (no per-context enumeration) that forbids any import of that context's internals — `domain/`, `application/`, `infrastructure/`, and its top-level Drizzle schema/model file — from outside the context, while allowing unrestricted intra-context imports and unrestricted `src/shared/*` imports from anywhere. Violations fail `pnpm lint` with a message naming the violated context and pointing at its `bcs/<name>/CONTRACT.md`. Because `004-ci-pipeline` already commits to running `pnpm lint` as a required PR check, this feature's CI-facing requirement (FR-007) is satisfied by folding the rule into the existing `eslint.config.mjs` — no separate CI wiring is authored here.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode), Node.js >=24

**Primary Dependencies**: ESLint 9 (flat config, via `eslint-config-next`); new devDependency `eslint-plugin-boundaries` for the boundary rule itself (see research.md for why this over `dependency-cruiser` or hand-rolled `no-restricted-imports`)

**Storage**: N/A — this feature touches only lint configuration, no runtime data

**Testing**: Vitest, exercising the ESLint flat config programmatically via `Linter.verify()`/`ESLint.lintText()` against in-memory fixture snippets (mirrors this repo's existing colocated-test convention; no real violating files are added to `src/`)

**Target Platform**: Developer workstations (local `pnpm lint`) and GitHub Actions CI (once `004-ci-pipeline` wires `pnpm lint` in)

**Project Type**: Single project — root-level Next.js/TypeScript app per `context/repo-structure.md`; this feature only edits `eslint.config.mjs` (plus its own test file) and `package.json`

**Performance Goals**: No new performance target of its own; must stay within `004-ci-pipeline`'s stated ~5-minute full-pipeline budget, and lint must not meaningfully slow the local dev loop (target: boundary rule adds no perceptible overhead over the existing `eslint-config-next` lint pass)

**Constraints**: Must live inside the existing flat `eslint.config.mjs` array (per CLAUDE.md: no `FlatCompat` wrapping of `eslint-config-next`'s native flat array); must not require per-bounded-context config edits when a new BC folder is added (FR-008); must apply identically to test files and type-only imports (no exemptions, per Clarifications)

**Scale/Scope**: 7 existing bounded contexts (`prompt-registry`, `distribution`, `identity-access`, `governance`, `audit-compliance`, `workflow-orchestration`, `billing-entitlements`) plus `src/shared/*`; rule must generalize to any future BC folder without modification

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Assessment |
|---|---|---|
| I. Test-First Development `[P1]` | Yes, in spirit | No backend domain logic here, but the same red-green discipline applies to the lint config itself: fixture-based Vitest tests asserting a violating import fails and a barrel/shared import passes MUST be written and shown red before the rule config is added, then green after — see Phase 1 quickstart.md. |
| II. Domain-Driven Bounded Contexts `[D1]` | Yes — this feature directly implements it | This feature exists solely to make D1 build-breaking rather than a review convention. No conflict; this is the gate this feature closes. |
| III. Domain Invariants in Domain Layer `[D2]` | No | N/A — no domain model or business rule is introduced. |
| IV. Multi-Tenant Isolation `[M1-M3]` | No | N/A — lint configuration has no tenant dimension. |
| V. Secure by Default `[S1-S3]` | No | N/A — no secrets, templates, or logging touched. |
| VI. Auditable & Compliant `[C1-C2]` | No | N/A — no mutation or audit-relevant read path introduced. |
| VII. Feature-Gated by Entitlement `[G1]` | No | N/A — a lint rule is a build-time developer-facing control, not a product feature/route/tool with a Free-vs-Paid dimension; nothing to gate. |

No violations. Nothing required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-module-boundary-lint-enforcement/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no external API, CLI surface, or service endpoint — it is build tooling (an ESLint rule configuration), which the planning workflow's contracts step explicitly treats as skippable. The rule's "contract" (which imports pass/fail, and the resulting message) is captured instead in data-model.md and validated by quickstart.md.

### Source Code (repository root)

```text
eslint.config.mjs                    # MODIFIED — adds boundaries plugin + boundaries/dependencies rule (element types + policies)
eslint.config.test.ts                # NEW — fixture-based Vitest tests against the flat config (Linter.verify() on in-memory snippets)
package.json                         # MODIFIED — new devDependency: eslint-plugin-boundaries

src/
├── bcs/
│   ├── identity-access/             # existing — unaffected, boundary target
│   ├── governance/                  # existing — unaffected, boundary target
│   └── ...                          # other existing BCs — unaffected, boundary targets
├── shared/                          # existing — unaffected, always-importable
└── app/                             # existing — unaffected, boundary target (must also go through barrels)

bcs/<name>/CONTRACT.md               # existing — referenced (not modified) by the rule's error message
```

**Structure Decision**: Single project, matching the existing root-level Next.js/TypeScript scaffold (`context/repo-structure.md`). This feature is scoped entirely to lint configuration — it edits `eslint.config.mjs` and `package.json` at the repo root and adds one colocated test file; it does not add, move, or restructure any `src/bcs/*` or `src/shared/*` code. Test file colocation follows `context/testing-strategy.md`'s `foo.ts` → `foo.test.ts` convention, applied to the config file itself.

## Constitution Check (post-Phase 1 re-check)

Re-evaluated after research.md/data-model.md/quickstart.md were written: no new principle applies and none of the Phase 0/1 design decisions (tool choice, decision-logic steps, colocated fixture-test approach, deferring CI wiring to `004-ci-pipeline`) introduce a tenant, secrets, audit, or entitlement dimension that wasn't already assessed pre-research. The Principle I (test-first) commitment is now concrete: quickstart.md Scenario 6 names the exact colocated fixture-test file (`eslint.config.test.ts`) that must exist and initially fail before the rule config is added. Gate still passes; no change to Complexity Tracking.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty.
