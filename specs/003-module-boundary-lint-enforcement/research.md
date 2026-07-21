# Research: Module Boundary Lint Enforcement

## Decision 1: Lint tool — `eslint-plugin-boundaries` over `dependency-cruiser` or hand-rolled `no-restricted-imports`

**Decision**: Use `eslint-plugin-boundaries`, added to the existing flat `eslint.config.mjs`.

**Rationale**:
- FR-008 requires the rule to apply generically to any bounded context under `src/bcs/<name>/`, including contexts added later, with **no per-context configuration**. `eslint-plugin-boundaries` supports element types defined by a *pattern with a capture group* (e.g. `src/bcs/*` capturing the BC name as `category`), so "same category, different captured id" is expressed once, generically — it is not an enumerated allowlist of BC names.
- **Current API note (verified against the installed version's docs, `jsboundaries.dev`, at implementation time)**: as of v7, `boundaries/entry-point` and `boundaries/element-types` are **deprecated aliases** kept only for backward compatibility (they still work but print a deprecation warning). The canonical, non-deprecated rule is `boundaries/dependencies`, configured with a `policies` array of `{ from, to, dependency, allow, disallow, message }` objects. This feature uses `boundaries/dependencies` exclusively — starting a brand-new config on a deprecated rule name would ship day-one deprecation warnings for no benefit. The single `boundaries/dependencies` rule reproduces both the old entry-point restriction (via a policy matching `to.element.fileInternalPath: "!index.ts"`) and the element-type restriction (via `to.element.type`), so nothing is lost by skipping the deprecated pair.
- The plugin's dependency metadata exposes `dependency.relationship.to === "internal"` for any import that stays within the same element instance — this is documented as the built-in mechanism for "any file can import other files of the same element," which is exactly FR-004's intra-context allowance, with no need to compare captured values by hand.
- The rule's `message` option supports Handlebars templates reading `to.element.captured.*`, satisfying FR-006 (point the developer at the violated context's `CONTRACT.md`).
- It integrates as an ESLint rule inside the single existing `eslint.config.mjs`, so `pnpm lint` (and, once `004-ci-pipeline` lands, CI's existing `pnpm lint` step) picks it up with zero new tooling wiring. `dependency-cruiser` is a separate CLI with its own config file and its own invocation, which would require a second `package.json` script and a second CI step to get the same enforcement — more moving parts for an equivalent result.
- A hand-rolled `no-restricted-imports` (ESLint core rule) cannot express "same category but different instance" — it matches on the *importing* file's static config, not a relationship between the importing file's own captured BC name and the imported file's captured BC name, so it would need one explicit pattern per BC pair, violating FR-008 outright.

**Alternatives considered**:
- `dependency-cruiser`: capable of the same rule shape via regex backreferences, but introduces a second lint tool/config/CI step for no behavioral gain over staying inside ESLint.
- Hand-rolled `no-restricted-imports` per BC: rejected — cannot generalize across BCs (fails FR-008) without a config edit per new context.
- The deprecated `boundaries/entry-point` + `boundaries/element-types` pair: rejected in favor of the canonical `boundaries/dependencies` rule — same behavior, no deprecation warnings, and one rule to configure instead of two.

## Decision 1a: Two implementation-time corrections found by empirical testing, not by reading docs alone

**Context**: Before writing the final fixture-test suite, the design was validated against the *actual installed* `eslint-plugin-boundaries@7.1.0` using throwaway scripts calling `ESLint.lintText()` directly (with `ESLINT_PLUGIN_BOUNDARIES_DEBUG=1` to inspect the plugin's own entity/dependency descriptions) — not left as an assumption from documentation alone. Two bugs surfaced this way:

1. **Element pattern must not include a trailing `**`.** The original design used `pattern: "src/bcs/*/**"` for the `bc` element type. `eslint-plugin-boundaries`'s `partialMatch` option (default `true`) already expands a folder pattern internally (effectively appending `/**/*`) to match any file at any depth beneath the matched folder. Adding an explicit trailing `**` on top of that double-appends a wildcard and shifts where the plugin considers the "element path" to end — empirically, this made `domain/*.ts` and `application/*.ts` files within the *same* BC resolve to two *different* element instances (different `element.path` values), so `dependency.relationship.to` was never `"internal"` for intra-context imports, incorrectly denying them. Corrected pattern: `"src/bcs/*"` (and likewise `"src/shared"`, `"src/app"` — no trailing `**` on any element pattern).
2. **`app` must be declared as an element type after all**, reversing what `/speckit-analyze`'s remediation concluded. Reading `Rules/Support/DependencyRule.js` in the installed package showed the rule's visitor returns `{}` (analyzes zero imports) whenever the importing file is *both* `element.isUnknown` and `file.isUnknown`. Since no `boundaries/files` category was defined either, an undeclared `src/app/**` file is doubly-unknown and the rule silently never inspects its imports at all — regardless of how the disallow policy itself is written. Declaring `{ type: "app", pattern: "src/app" }` makes `element.isUnknown` false, so the visitor actually runs.

**Why this matters for the process**: both bugs would have shipped silently if the config had only been checked against `pnpm lint`'s current clean output (which stays green either way, since the existing codebase has no cross-context imports yet to exercise these paths) — they were only caught by writing adversarial fixture cases and inspecting the plugin's own debug output before finalizing the rule. This is why tasks.md's fixture-test tasks (T004, T011, T014 in particular) are load-bearing, not decorative.

## Decision 2: Enforcement of the schema/model-specific case (FR-002)

**Decision**: No separate mechanism beyond the general internal-path policy (Decision 1). A BC's Drizzle schema/model file (per `context/repo-structure.md`, a top-level `schema.ts` sibling to `index.ts`, or files under `infrastructure/`) has a `fileInternalPath` other than `index.ts`, so the same `boundaries/dependencies` policy that forbids any non-barrel cross-BC import already forbids direct schema/model imports without a distinct rule or policy.

**Rationale**: Per the Clarifications session, FR-002 only needs to catch *direct internal-path* imports of schema/model files — it explicitly does not need to detect schema/model objects re-exported through a barrel (that's a barrel-design/`CONTRACT.md` concern). A path-based rule that already blocks all non-barrel internal paths therefore covers FR-002 as a strict subset of FR-001, with no additional configuration.

**Alternatives considered**: A dedicated rule inspecting *import names* (e.g. flagging anything matching `*Schema`/`*Table`) to also catch schema objects re-exported through a barrel — rejected per the clarification answer; out of scope for this feature.

## Decision 3: Error message content and format (FR-006)

**Decision**: Configure the `boundaries/dependencies` policy's `message` option with a Handlebars template that interpolates the violated element's captured BC name (`{{to.element.captured.category}}`) into a path like `bcs/{{to.element.captured.category}}/CONTRACT.md` (the repo-root `bcs/<name>/CONTRACT.md`, distinct from `src/bcs/<name>/`), plus a short human sentence naming this as a bounded-context boundary violation.

**Rationale**: `bcs/<name>/CONTRACT.md` (confirmed to exist for all 6 current contexts at the repo root, e.g. `bcs/governance/CONTRACT.md`) is the authoritative "Exposed APIs" document per `context/repo-structure.md`; pointing there directly satisfies SC-003 (developer can identify the violated contract and where to find it from the error text alone).

**Alternatives considered**: A generic message with no per-context path — rejected; SC-003 explicitly requires the message to name where to look without asking a teammate.

## Decision 4: Testing approach for the lint rule itself

**Decision**: Colocated `eslint.config.test.ts` using ESLint's programmatic API (`ESLint.lintText()`), passing each fixture's *importing* file only as in-memory text (via the `filePath` option, never actually written to disk) — but backed by a small number of real, transient *target* files that are written to disk immediately before each test and deleted in the same test (via `node:fs`, in a `try`/`finally`), never committed to git.

**Rationale**: An earlier draft of this decision assumed both sides of an import could be purely virtual/non-existent paths. Empirical testing (see Decision 1a) disproved this: `eslint-plugin-boundaries` resolves import specifiers through `eslint-import-resolver-node`, which performs real filesystem resolution — an import target that does not exist on disk resolves to nothing, and the dependency is silently never classified or reported (confirmed directly: a nonexistent target produced zero ESLint messages regardless of the rule configuration). The *importing* file's content can still be pure in-memory text passed via `filePath` — the resolver only needs the **target** to be real. So each fixture test writes one small real placeholder file (e.g. `export const x = 1;`) at the target path the fixture's import specifier points to, runs `ESLint.lintText()` with the importing file as text, and deletes the placeholder — keeping the "no real violating files committed to `src/`" property from the original decision while working within the resolver's actual constraints. This still matches `context/testing-strategy.md`'s colocated Vitest convention and still gives Principle I's red-green cycle in spirit (T004 is written and confirmed red before T005 exists).

**Alternatives considered**:
- Purely virtual, non-existent import targets: rejected — proven empirically not to work; the plugin cannot classify or flag an import whose target fails real filesystem resolution.
- Committing permanent fixture files under a dedicated `src/bcs/__fixtures__/` tree: rejected; would need its own lint-ignore carve-out and could drift from the real BC folder shape over time, whereas transient files written and deleted within a single test never persist.

## Decision 5: CI wiring (FR-007)

**Decision**: No new CI workflow is authored by this feature. `004-ci-pipeline` (open, not yet built) already commits to running `pnpm install && pnpm lint && pnpm typecheck && pnpm test` on every PR, with an explicit requirement that "module-boundary lint rule (`003-module-boundary-lint-enforcement`) runs as part of the lint step." Once this feature's rule is part of `pnpm lint`, `004-ci-pipeline` picks it up automatically the moment it wires `pnpm lint` into GitHub Actions — no duplicate effort needed here.

**Rationale**: Avoids building CI infrastructure twice (once here, once in `004-ci-pipeline`) and matches the existing repo's dependency direction (`004-ci-pipeline`'s own requirements list names this feature as a prerequisite of its lint step, not the reverse).

**Alternatives considered**: Standing up a minimal one-off GitHub Actions workflow just for the boundary rule ahead of `004-ci-pipeline` — rejected as scope creep; `context/repo-structure.md`'s own "Consumed by" section already assigns CI enforcement to `004-ci-pipeline`, not this feature.
