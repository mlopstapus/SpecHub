# Quickstart: Validating Module Boundary Lint Enforcement

This guide proves the feature works end-to-end once implemented. It does not include implementation code — see `data-model.md` for the decision logic and `research.md` for tool/config decisions; implementation itself belongs to `tasks.md`.

## Prerequisites

- `pnpm install` has run (picks up the new `eslint-plugin-boundaries` devDependency once added, per `research.md` Decision 1).
- Working tree on branch `003-module-boundary-lint-enforcement`.

## Scenario 1 — Cross-context internal import fails (User Story 1)

Import resolution is real filesystem resolution (`eslint-import-resolver-node`), so the import target must exist on disk — a nonexistent target silently produces no diagnostic at all (see `research.md` Decision 1a/4).

1. Temporarily add a target file, e.g. `src/bcs/identity-access/domain/__quickstart_target.ts`, containing `export const something = 1;`.
2. Temporarily add a file, e.g. `src/bcs/governance/application/__quickstart_violation.ts`, containing:
   ```ts
   import { something } from "../../identity-access/domain/__quickstart_target";
   ```
3. Run `pnpm lint`.
4. **Expected**: non-zero exit; an error (not a warning) on the added import, whose message identifies it as a bounded-context boundary violation and references `bcs/identity-access/CONTRACT.md`.
5. Delete both temporary files.

## Scenario 2 — Barrel import passes (User Story 2)

1. Temporarily add a file, e.g. `src/bcs/governance/application/__quickstart_ok.ts`, containing:
   ```ts
   import { resolveEffectivePolicies } from "@/bcs/identity-access";
   ```
   (Or any currently-exported barrel member — the barrels are placeholder `export {}` today, so any named import will itself fail to resolve; a bare `import "@/bcs/identity-access";` is sufficient to prove no *boundary* error is raised.)
2. Run `pnpm lint`.
3. **Expected**: no boundary-related error for this import.
4. Delete the temporary file.

## Scenario 3 — Shared import passes from anywhere (User Story 2)

1. Temporarily add a file under any BC, e.g. `src/bcs/governance/domain/__quickstart_shared.ts`, containing:
   ```ts
   import { getLogger } from "@/shared/logging";
   ```
2. Run `pnpm lint`.
3. **Expected**: no boundary-related error.
4. Delete the temporary file.

## Scenario 4 — Intra-context import passes

1. Temporarily add a target file, e.g. `src/bcs/governance/domain/__quickstart_target.ts`, containing `export const something = 1;`.
2. Temporarily add a file, e.g. `src/bcs/governance/application/__quickstart_intra.ts`, importing from `../domain/__quickstart_target` within the same `governance` context.
3. Run `pnpm lint`.
4. **Expected**: no boundary-related error.
5. Delete both temporary files.

## Scenario 5 — No exemption for test files or type-only imports (Clarifications)

1. Reuse (or recreate) the target file from Scenario 1, `src/bcs/identity-access/domain/__quickstart_target.ts`.
2. Temporarily add `src/bcs/governance/application/__quickstart_violation.test.ts` containing a cross-context internal import identical to Scenario 1, once as a value import and once as `import type { X } from "../../identity-access/domain/__quickstart_target"`.
3. Run `pnpm lint`.
4. **Expected**: both fail identically to Scenario 1 — filename pattern and `import type` make no difference.
5. Delete the temporary files.

## Scenario 6 — Automated fixture suite (replaces manual steps 1–5 for CI/regression purposes)

Run:
```sh
pnpm test eslint.config.test.ts
```
**Expected**: all fixture cases pass — this file exercises Scenarios 1–5 programmatically via `ESLint.lintText()`, writing small real transient target files immediately before each test and deleting them after (see `research.md` Decision 4 — a nonexistent import target cannot be classified by the plugin, so pure virtual/in-memory paths don't work for the target side).

## Scenario 7 — New bounded context requires no config change (FR-008)

1. Create a folder `src/bcs/__quickstart_new_bc/` with a real `index.ts` (e.g. `export {};`) and a real file under `domain/` (e.g. `domain/__quickstart_target.ts` containing `export const something = 1;`).
2. Without touching `eslint.config.mjs`, add a temporary file to an existing BC (e.g. `src/bcs/governance/application/__quickstart_new_bc_violation.ts`) importing directly from `../../__quickstart_new_bc/domain/__quickstart_target` (bypassing the new context's barrel).
3. Run `pnpm lint`.
4. **Expected**: the violation is caught exactly as in Scenario 1, proving the rule generalized to the new context with zero configuration change.
5. Delete the temporary folder and file.

## Success Criteria Mapping

| Scenario | Success Criteria |
|---|---|
| 1, 5, 7 | SC-001 (100% of cross-context violations caught, incl. new BCs, test files, type-only imports) |
| 2, 3, 4 | SC-002 (100% of sanctioned imports pass, zero false positives) |
| 1 | SC-003 (violation message names the violated contract) |
| 6 | SC-004 (regression-proof via automated suite, ready for `004-ci-pipeline` to gate merges on) |
