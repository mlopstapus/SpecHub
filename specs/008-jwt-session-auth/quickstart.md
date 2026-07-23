# Quickstart: JWT Session Auth

Validates login, session resolution, logout, the fail-closed `JWT_SECRET` check, and login/logout audit events — all at the application layer (no HTTP route exists yet; see plan.md's Project Structure / research.md §5).

## Prerequisites

- `pnpm install` (adds `jose` once it's in `package.json`)
- Docker available locally (Testcontainers spins up an ephemeral Postgres per test file — no manual DB setup)
- A real (non-placeholder) `JWT_SECRET` set for any manual/REPL exercise outside the test suite (tests set it directly, not via `.env`)

## Run the automated checks

```bash
pnpm typecheck
pnpm lint
pnpm vitest run src/shared/config
pnpm vitest run src/bcs/identity-access
pnpm vitest run src/bcs/audit-compliance
```

Expected: all pass, including the Testcontainers-backed integration tests for `login`/`authenticateSession`/`logout`/`record`.

## Manually exercise the flow (no route handler yet — call the application functions directly)

Against a running dev Postgres (`docker compose up -d database`, migrations applied via `pnpm db:migrate`) and a real `JWT_SECRET` exported in the shell:

```ts
// scratch.ts, run via `pnpm exec tsx scratch.ts` or similar — not part of the shipped codebase
import { db } from "@/shared/db/client";
import { login, authenticateSession, logout } from "@/bcs/identity-access";

const result = await login(db, "admin@example.com", "correct-horse-battery-staple");
console.log(result); // { user: { id, orgId, teamId, role, email }, cookie: { name, value, ... } } or null

if (result) {
  const cookieHeader = `${result.cookie.name}=${result.cookie.value}`;
  const user = await authenticateSession(db, cookieHeader);
  console.log(user); // same UserSummary

  const bad = await authenticateSession(db, "sh_session=garbage");
  console.log(bad); // null

  const { cookie: cleared } = await logout(db, result.user.id);
  console.log(cleared); // { name, value: "", maxAge: 0, ... }
}
```

## Expected outcomes (maps to spec.md's Success Criteria)

- Valid credentials → non-null `login()` result, cookie resolves back to the same user via `authenticateSession` (SC-001, SC-005).
- Wrong password / unknown email → both return `null` from `login()`, indistinguishable (SC-003).
- A hand-crafted or expired token passed to `authenticateSession` → `null`, never a thrown error (SC-002).
- Unsetting or placeholder-ing `JWT_SECRET` before any of the above → `getJwtSecret()` throws on the first sign/verify attempt (SC-004; see `src/shared/config/index.test.ts`).
- Querying `audit.audit_events` after any `login()`/`logout()` call shows exactly one new row with the corresponding `action`, and no `password`/token value anywhere in `before`/`after` (FR-011–FR-013).

## Out of scope for this quickstart

No `curl`/browser flow — there is no HTTP route or login page yet (owned by `backlog/007-distribution/001-rest-api-core-routes.md` / `.../003-web-ui-shell-and-core-pages.md`, per research.md §5). This quickstart validates the contract functions those future routes will call.
