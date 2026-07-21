# Data Model: Module Boundary Lint Enforcement

This feature has no runtime data model (no database tables, no domain entities persisted anywhere). The "model" here is the **lint configuration's element taxonomy** — the structural concepts the ESLint rule reasons about — plus the **decision logic** it applies to every import statement in the codebase.

## Configuration Entities

### Element Type: `bc` (Bounded Context)

- **Pattern**: `src/bcs/*` (a single wildcard, capturing `category`) — **not** `src/bcs/*/**`. `eslint-plugin-boundaries`'s `partialMatch` (default `true`) already expands a folder pattern internally to match any file at any depth beneath it; adding a trailing `**` of one's own double-appends a wildcard and shifts the matched "element path" down into each subdirectory instead of stopping at `src/bcs/<category>`. This was caught empirically during implementation (see research.md Decision 1a) — with the wrong pattern, `domain/` and `application/` files were treated as two *different* element instances of the same BC, breaking intra-context detection.
- **Barrel identification**: with the corrected pattern, a `bc` file's `fileInternalPath` (relative to the matched `src/bcs/<category>` folder) equals exactly `index.ts` for the barrel; every other file (`domain/*`, `application/*`, `infrastructure/*`, a top-level `schema.ts`) has some other `fileInternalPath`.
- **Represents**: Every file inside a bounded context's folder, whether under `domain/`, `application/`, `infrastructure/`, a top-level `schema.ts`, or the barrel itself.
- **Identity rule**: Two files belong to the *same* `bc` instance only if they resolve to the same matched folder (i.e. the same captured `category`) — the plugin exposes this directly as `dependency.relationship.to === "internal"`, without hand-comparing captured values. Same-instance imports are unrestricted (FR-004); different-instance imports must go through the target instance's barrel (FR-001/FR-002), with no exemption for test files (FR-009) or type-only imports (FR-010).

### Element Type: `shared`

- **Pattern**: `src/shared` (no trailing `**`, same reasoning as `bc` above).
- **Entry point**: None required — importable from anywhere without restriction (FR-003).
- **Represents**: Cross-cutting code with no bounded-context ownership (`db`, `ui`, `config`, `logging`).

### Element Type: `app`

- **Pattern**: `src/app` — **must be declared**, unlike what an earlier draft of this document assumed. Reading the plugin's own rule source (`Rules/Support/DependencyRule.js`) during implementation showed that the dependency-analysis visitor exits immediately (`return {}`, analyzing *no* imports from that file at all) whenever the importing file is *both* `element.isUnknown` and `file.isUnknown`. Since no `boundaries/files` category is defined either, an undeclared `src/app/**` file would be doubly-unknown, and the `boundaries/dependencies` rule would never even inspect its imports — silently defeating the "code outside `src/bcs/*` reaching into a BC's internals must fail" edge case regardless of how the disallow policy itself is written.
- **Represents**: Route handlers and other code that consumes bounded contexts but is not itself one. Per spec Edge Cases, `src/app/` reaching into a BC's internals must fail the same way as one BC reaching into another's — verified directly by a dedicated fixture test (tasks.md T011) and confirmed empirically during implementation.

### Contract reference: `bcs/<category>/CONTRACT.md`

- **Not a code element** — a documentation file at the repo root (`bcs/<name>/CONTRACT.md`, distinct from `src/bcs/<name>/`), one per bounded context, already existing for all current BCs.
- **Role**: Interpolated into the violation message by `category` so the message names the specific contract file to consult (FR-006, SC-003). Read-only from this feature's perspective — never modified by the lint rule or its tests.

## Decision Logic: `boundaries/dependencies` policies (evaluated in order, last match wins)

This is expressed as exactly two ordered policies on the single `boundaries/dependencies` rule, with `default: "allow"`:

1. **Policy 1 (general disallow)**: `disallow: { to: { element: { type: "bc", fileInternalPath: "!index.ts" } } }` — matches *any* importer (the policy has no `from` clause) whose import target is a `bc` element file other than that instance's `index.ts`. This alone would incorrectly also catch legitimate intra-context imports, which is why Policy 2 exists.
2. **Policy 2 (intra-context exception)**: `allow: { dependency: { relationship: { to: "internal" } } }` — matches any import where importer and target are the *same* element instance (the plugin's built-in same-element signal), and, being the later policy, overrides Policy 1's disallow for that case.

Net effect per case (all verified empirically against the real installed plugin during implementation, not just reasoned about):
- **`bc` → same-instance non-barrel file** (FR-004; barrel re-exporting its own internals, spec Edge Cases): Policy 1 matches (disallow) → Policy 2 also matches (relationship internal) → final: **allow**.
- **`bc` A → `bc` B's non-barrel file, or `bc` A → `bc` B's barrel** (FR-001/FR-002, User Story 1/2): for the non-barrel case, Policy 1 matches (disallow), Policy 2 does not (relationship is not `"internal"` across different instances) → final: **deny**. For the barrel case, Policy 1 does not match at all (`fileInternalPath` *is* `index.ts`, whether the import specifier names the file explicitly or resolves to it implicitly via a directory-style import like `@/bcs/identity-access`) → final: **allow** (the default).
- **`src/app/**` → a `bc`'s non-barrel file** (spec Edge Cases; verified by tasks.md T011): with `app` declared as an element type (see Configuration Entities above), the file is no longer doubly-unknown, so its imports are analyzed at all; Policy 1 matches (disallow; it never checks the importer's own type) — Policy 2 does not (an unclassified importer can never share a `bc` element instance) → final: **deny**.
- **Any import targeting `shared` (or anything not typed `bc`)** (FR-003): Policy 1 does not match (`to.element.type` isn't `"bc"`) → final: **allow** (the default).
- Test-file importers (FR-009) and `import type` dependencies (FR-010): neither policy's selector references `file.categories` or `dependency.kind`, so both properties are irrelevant to the match — the same allow/deny outcome holds regardless.

## Validation Rules Summary

| Requirement | Enforced by |
|---|---|
| FR-001 (forbid cross-context internal import) | Policy 1, not overridden by Policy 2 |
| FR-002 (forbid cross-context schema/model import) | Policy 1 (a schema/model file's `fileInternalPath` is never `index.ts`, so no separate policy needed) |
| FR-003 (allow `src/shared/*` from anywhere) | `default: "allow"` — Policy 1 never matches a non-`bc` target |
| FR-004 (allow intra-context imports) | Policy 2 overriding Policy 1 |
| FR-005 (violation is an error, not a warning) | `boundaries/dependencies` configured at ESLint severity `"error"`, not `"warn"`; fixture tests assert on severity level directly, not just diagnostic presence |
| FR-006 (message names contract) | Policy 1's `message` template interpolates `{{to.element.captured.category}}` into `bcs/{{to.element.captured.category}}/CONTRACT.md` |
| FR-007 (wired into CI) | Out of this feature's scope — see research.md Decision 5 |
| FR-008 (generic across BCs, no per-context config) | `bc` element type uses a captured pattern, not an enumerated list; Policy 1/2 reference the element *type*, never a specific instance |
| FR-009 (no test-file exemption) | Neither policy's selector references `file.categories` |
| FR-010 (no type-only-import exemption) | Neither policy's selector references `dependency.kind` |
