# Implementation Plan: App Shell & Navigation

**Branch**: `013-app-shell-navigation` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-app-shell-navigation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build the authenticated Next.js App Router shell as a server-enforced `(app)`
layout: resolve the httpOnly JWT cookie through Identity & Access, reject
missing/invalid/deactivated sessions before rendering, evaluate the
`coreFeaturesEnabled` UI entitlement through Billing & Entitlements, and only
then render the persistent mockup-derived navigation and account footer.
Identity & Access gains an app-session view that returns the live display name,
team name, role, and active state in one local query. Navigation remains a small
client island for pathname-aware active state while the shell and access checks
stay server-rendered.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 24; React 19.2

**Primary Dependencies**: Next.js 16.2 App Router, Drizzle ORM 0.45,
`jose` 6.2, Tailwind CSS 4.3, existing `authDb` and bounded-context barrels

**Storage**: PostgreSQL (read-only access to existing
`identity_access.users`/`identity_access.teams`); no new table or migration.
The entitlement check uses the catalog's current hardcoded Free defaults until
the persisted Billing & Entitlements model lands.

**Testing**: Vitest 4.1; Testcontainers-backed Identity & Access integration
tests; pure unit tests for access-state and pathname mapping; server-rendered
component contract tests via `react-dom/server`; Next.js build, TypeScript, and
ESLint verification

**Target Platform**: Modern browsers served by the unified Next.js application;
Node.js runtime in Docker/Kubernetes or local development

**Project Type**: Full-stack web application (Next.js App Router modular
monolith)

**Performance Goals**: No protected-content flash or protected RSC payload in a
denied response; the pre-render proxy performs the authoritative early access
check and the layout repeats it as defense in depth, for at most two JWT
verifications, Identity reads, and local entitlement resolutions per initial
app request; client-side navigation preserves the shared layout

**Constraints**: Auth checks run before shell/page rendering; deactivated users
fail closed on their next request; Identity and Billing are imported only
through their public barrels from `src/app`; authenticated app remains
dark-only; no page-owned feature content or account-menu behavior is added;
pathname matching must map governance routes before the broader `/teams`
prefix

**Scale/Scope**: One shared layout, nine navigation links, three access states,
one session view contract, one provisional entitlement facade, and a minimal
`/dashboard` composition point

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Test-First Development** — PASS. Failing tests precede changes to
  session resolution, access-state orchestration, and pathname mapping.
- **II. Domain-Driven Bounded Contexts** — PASS. Identity data shaping remains
  inside `identity-access`; entitlement defaults/checks remain inside
  `billing-entitlements`; `src/app` imports only their barrels.
- **III. Domain Invariants Live in the Domain Layer** — PASS. Session activity
  and entitlement decisions are exposed through owning-context contracts, not
  re-derived in page components.
- **IV. Multi-Tenant Isolation by Default** — PASS. Session resolution uses the
  existing `authDb` pre-auth path and joins a team only when both team and user
  share the same organization. No tenant-scoped table or unscoped app-role
  query is added.
- **V. Secure by Default** — PASS. Raw cookies/JWTs are never logged or exposed
  to client components; unauthenticated and deactivated sessions render no
  protected content.
- **VI. Auditable & Compliant** — PASS (N/A for writes). The feature performs no
  mutation and adds no security-critical defaults. Infrastructure failures are
  not logged with cookie material or silently converted into authenticated
  access.
- **VII. Feature-Gated by Entitlement** — PASS. Every app-shell render checks
  `coreFeaturesEnabled`; denied organizations receive a shell-free
  access-unavailable state.

**Post-design re-check**: PASS. The data model and UI contract preserve the
same boundaries; no new database entity, mutation, or unaudited path was added.

## Project Structure

### Documentation (this feature)

```text
specs/013-app-shell-navigation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── app-shell-ui.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── proxy.test.ts
├── proxy.ts
├── app/
│   ├── access-unavailable/
│   │   └── page.tsx
│   └── (app)/
│       ├── _components/
│       │   ├── account-footer.test.tsx
│       │   ├── account-footer.tsx
│       │   ├── app-navigation.test.tsx
│       │   ├── app-navigation.tsx
│       │   ├── app-shell.test.tsx
│       │   ├── app-shell.tsx
│       │   ├── nav-model.test.ts
│       │   └── nav-model.ts
│       ├── dashboard/
│       │   └── page.tsx
│       ├── access-unavailable.tsx
│       ├── app-shell-access.test.ts
│       ├── app-shell-access.ts
│       └── layout.tsx
└── bcs/
    ├── identity-access/
    │   ├── application/
    │   │   ├── authenticate-session.test.ts
    │   │   └── authenticate-session.ts
    │   ├── infrastructure/users-repo.ts
    │   ├── domain/user.ts
    │   ├── CONTRACT.md
    │   └── index.ts
    └── billing-entitlements/
        ├── application/
        │   ├── has-entitlement.test.ts
        │   ├── has-entitlement.ts
        │   ├── resolve-entitlements.test.ts
        │   └── resolve-entitlements.ts
        ├── domain/entitlement.ts
        ├── CONTRACT.md
        └── index.ts

backlog/009-billing-entitlements/
└── 004-entitlement-enforcement-integration.md
```

**Structure Decision**: Keep route enforcement and shell composition in the
App Router's private `(app)` subtree. Only the pathname-aware nav is a Client
Component; all identity/entitlement reads happen in a Server Component through
bounded-context barrels. Extend the existing Identity & Access session contract
rather than querying its tables from `src/app`, and pull forward only the
Billing-owned default-backed `resolveEntitlements`/`hasEntitlement` facade
needed to name this feature's constitutional gate.

## Complexity Tracking

The constitution has no violation. This table records the repository-required
sequencing exception for work pulled forward from a future epic.

| Complexity / sequencing exception                                | Why Needed                                                                                                                      | Simpler Alternative Rejected Because                                                                                                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull forward a narrow facade from future Billing feature 001/004 | Constitution G1 requires this UI surface to call its owning entitlement contract now, before the persisted billing model exists | Skipping the check violates G1; importing Identity's private hardcoded stand-in violates D1; implementing the full billing schema/Stripe lifecycle would expand this shell feature far beyond its needs |
