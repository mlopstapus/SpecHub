# Contract: Bounded-Context Barrel Shape

This is the internal "interface" this feature establishes: every bounded context exposes exactly one public entry point, and every later epic that adds real functionality to a BC must conform to this shape rather than introducing a new one.

## Shape

```ts
// src/bcs/<name>/index.ts
export {};
```

An empty barrel is valid and importable. As of this feature, no bounded context exports anything — later epics add real exports here, and only here; `domain/`, `application/`, and `infrastructure/` subfolders are never imported from outside the BC's own folder (enforced in CI by a later item, `module-boundary-lint-enforcement`, not by this feature).

## Applies to

`identity-access`, `governance`, `prompt-registry`, `workflow-orchestration`, `billing-entitlements`, `audit-compliance`, `distribution` — all seven, identically.

## Stability guarantee

This barrel-only-export pattern does not change when a BC gains real functionality — an epic adds named exports to an existing `index.ts`, it never adds a second public entry point or exports something from outside `index.ts`.
