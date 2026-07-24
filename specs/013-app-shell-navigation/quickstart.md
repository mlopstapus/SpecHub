# Quickstart: App Shell & Navigation

## Prerequisites

- Node.js 24+
- pnpm 10.26+
- Docker available for Testcontainers-backed Identity & Access tests
- Dependencies installed with `pnpm install`

## Focused red/green tests

Run the feature's focused tests:

```bash
pnpm vitest run \
  src/bcs/identity-access/application/authenticate-session.test.ts \
  src/bcs/billing-entitlements/application/resolve-entitlements.test.ts \
  src/bcs/billing-entitlements/application/has-entitlement.test.ts \
  src/proxy.test.ts \
  'src/app/(app)/app-shell-access.test.ts' \
  'src/app/(app)/_components/nav-model.test.ts' \
  'src/app/(app)/_components/app-navigation.test.tsx' \
  'src/app/(app)/_components/account-footer.test.tsx' \
  'src/app/(app)/_components/app-shell.test.tsx'
```

Expected: all session-activity, entitlement-denial, allowed-access, route-map,
and active-state cases pass.

## Static verification

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected:

- TypeScript reports no errors.
- ESLint reports no boundary or Next.js violations.
- Next.js builds `/dashboard` beneath the authenticated route-group layout
  without requiring a database connection during build.

## Unauthenticated route smoke test

Start the app:

```bash
pnpm dev
```

Then, from another terminal:

```bash
curl -i http://localhost:3000/dashboard
```

Expected: a temporary redirect to `/login`. The response body may contain the
redirect destination, but must contain no dashboard, account, navigation, or
app-shell markup.

## Authenticated behavior

The focused access tests are the reproducible validation path until
Distribution supplies a login HTTP route that can issue the already-implemented
session cookie in a browser. They prove:

1. Active session + enabled entitlement → shell allowed.
2. Deactivated/invalid session → unauthenticated.
3. Active session + denied entitlement → access-unavailable without shell.
4. Governance nested routes activate Governance, while team administration
   activates Teams.

When a browser session cookie is available, manually confirm the shell matches
the presentation contract in
[contracts/app-shell-ui.md](./contracts/app-shell-ui.md) and that every link
navigates to its recorded destination.
