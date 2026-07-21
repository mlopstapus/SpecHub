# Quickstart: Validating the Next.js App Scaffolding

## Prerequisites

- The Node.js/pnpm versions declared in `package.json`'s `engines`/`packageManager` fields (Corepack enabled: `corepack enable`).

## Setup

```bash
git clone <repo> && cd SpecHub
pnpm install
```

## Validate User Story 1 — boots locally (P1)

```bash
pnpm dev
```
Expected: server starts, a page is reachable locally, no errors in the terminal or browser console. Stop (`Ctrl+C`) and re-run — it must boot again with no extra setup steps.

## Validate User Story 2 — folder structure matches the decision (P2)

```bash
find src/bcs -maxdepth 1 -type d
find src/shared -maxdepth 1 -type d 2>/dev/null || find shared -maxdepth 1 -type d
```
Expected: exactly `identity-access`, `governance`, `prompt-registry`, `workflow-orchestration`, `billing-entitlements`, `audit-compliance`, `distribution` under `bcs/`, and exactly `db`, `ui`, `config`, `logging` under `shared/` — matching `context/repo-structure.md`. Each BC folder's `index.ts` must exist and compile (see `contracts/bounded-context-barrel.md`).

## Validate User Story 3 — quality gates pass (P3)

```bash
pnpm typecheck
pnpm lint
```
Expected: both exit 0 with no errors (lint: no warnings either) against the empty scaffold.

## Validate version pinning (FR-012)

```bash
# with a deliberately mismatched Node version active (e.g. via nvm/volta):
pnpm install
```
Expected: a clear version-mismatch error, not a silent install or a confusing downstream failure.

## Validate old code relocation (FR-011)

```bash
ls legacy/backend legacy/frontend   # old code present, relocated
ls backend frontend 2>&1            # expected: No such file or directory
```

## Full command surface check (SC-004)

```bash
pnpm install && pnpm dev & sleep 5 && kill %1
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```
Expected: none fail with "command not found" or a configuration error.
