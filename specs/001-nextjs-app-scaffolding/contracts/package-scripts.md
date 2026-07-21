# Contract: `package.json` Script Names

The set of command names this feature establishes is itself a contract — `CLAUDE.md` and `.claude/anchorstack/project.md` reference these names, and FR-009/SC-004 require them to keep working without drifting out of sync.

## Required scripts

| Script | Behavior in this feature |
|---|---|
| `install` (via `pnpm install`, not a custom script) | Installs all dependencies |
| `dev` | Starts the Next.js dev server; boots with zero errors on the empty scaffold |
| `build` | Production build; succeeds on the empty scaffold |
| `lint` | Runs ESLint; zero errors/warnings on the empty scaffold |
| `typecheck` | Runs `tsc --noEmit` (strict); zero errors on the empty scaffold |
| `test` | Runs Vitest; passes trivially (no real tests yet) |

## Stability guarantee

Later epics may add flags or extend what these scripts do (e.g. `test` eventually runs a real suite against Testcontainers), but they do not rename them or introduce a differently-named parallel script for the same purpose — any documentation referencing these six names continues to work.
