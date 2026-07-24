# Research: App Shell & Navigation

## 1. Protect the route group in a Server Component layout

**Decision**: Enforce session and entitlement access twice with the same
framework-free resolver: `src/proxy.ts` short-circuits denied requests before
route rendering, and `src/app/(app)/layout.tsx` repeats the check as
defense-in-depth before composing the shell. The proxy redirects unauthenticated
requests to `/login`, rewrites entitlement denial to the public
`/access-unavailable` system page, and allows valid requests to continue.

**Rationale**: The route-group layout is the one composition boundary every
current and future app page must cross, but empirical smoke testing showed that
Next.js may render a child RSC payload concurrently and include its content in a
layout-redirect response body. The proxy therefore performs the same full live
identity check before rendering starts, while the layout remains the
server-component authorization boundary recommended by Next.js. This prevents
both visible flashes and protected response-body leakage without duplicating
policy logic.

**Alternatives considered**:

- Cookie-presence-only `proxy.ts` — rejected because possession of a cookie is
  not proof of a valid or active session. The implemented proxy calls the same
  full resolver as the layout.
- Per-page guards — rejected because downstream pages could omit one, violating
  FR-001/FR-002 and the shell's purpose as the shared security boundary.
- Client-side redirect after hydration — rejected because protected content
  could render or flash before the check completes.

## 2. Return an app-session view from Identity & Access

**Decision**: Add `AppSessionUser`, an additive extension of `UserSummary` with
`displayName` and `teamName`, and make `authenticateSession()` return that
shape. Resolve it with one Identity-owned user/team join constrained by both
team ID and organization ID. Return `null` for a missing user, a missing team,
or `isActive=false`.

**Rationale**: The shell needs live name/team/role data and immediate
deactivation enforcement, while the JWT intentionally contains only minimal
claims. Querying Identity tables directly from `src/app` would violate the
bounded-context contract. A session-specific view gives the one UI consumer
exactly the safe, non-secret fields it needs without expanding the stable
cross-context `UserSummary` used elsewhere.

**Alternatives considered**:

- Add display/team names to `UserSummary` for every consumer — rejected because
  those presentation fields are not needed by every bounded context and would
  broaden a stability-guaranteed contract unnecessarily.
- Call `getUser()` and then a new `getTeam()` from the layout — rejected because
  it creates two sequential contract calls and makes the app layer assemble an
  Identity-owned view.
- Trust JWT role/team claims — rejected because auth conventions require
  current data to be re-resolved on every request, and team is not in the JWT.

## 3. Model access as three explicit states

**Decision**: A framework-free `resolveAppShellAccess()` returns one of:
`unauthenticated`, `entitlement-denied`, or `allowed` with `AppSessionUser`.
Its dependencies are injectable for unit tests; production defaults call
`authenticateSession(authDb, cookieHeader)` and
`hasEntitlement(orgId, "coreFeaturesEnabled")`.

**Rationale**: Authentication and entitlement denial have deliberately
different UX. A discriminated union makes the layout switch exhaustive, lets
tests prove that protected children never accompany either denial state, and
keeps Next.js's `redirect()` outside try/catch logic.

**Alternatives considered**:

- Throw for both denial types — rejected because expected access outcomes
  should not be conflated with infrastructure failures.
- Return a boolean — rejected because it cannot preserve the distinct login
  redirect versus access-unavailable behavior.

## 4. Pull forward only the Billing-owned entitlement facade

**Decision**: Implement the public `resolveEntitlements(orgId)` and
`hasEntitlement(orgId, key)` facade in Billing & Entitlements with the
hardcoded Free catalog from `docs/context/entitlements.md`. This is the
documented self-hosted behavior and a temporary default for the not-yet-built
SaaS storage path. Keep the future billing backlog item open and annotate that
it must replace the facade's provisional resolver with plan/override-backed
state.

**Rationale**: Constitution G1 requires a checked, named entitlement for every
UI surface, and `docs/context/feature-gating.md` says UI branching calls
`hasEntitlement()`. Billing owns this decision. Pulling forward a narrow facade
matches the repository's established pattern for immediate cross-epic
dependencies while avoiding premature billing tables, Stripe state, or
override workflows.

**Alternatives considered**:

- Skip the gate because the key defaults to true — rejected explicitly by G1.
- Reuse Identity's private `assertCoreFeaturesEnabled()` stand-in — rejected
  because it is owned by the wrong bounded context, throws instead of supporting
  UI branching, and is not exported.
- Implement the full Billing epic now — rejected as unrelated schema, webhook,
  audit, and Stripe scope.

**Implementation status (2026-07-23)**: Complete for this feature. The
default-backed facade and its unit tests are present, and the shell calls the
named `coreFeaturesEnabled` gate. Persisted plan/override resolution remains
explicitly open in
`backlog/009-billing-entitlements/004-entitlement-enforcement-integration.md`.

## 5. Keep active navigation a small Client Component

**Decision**: Define nav items and a pure `getActiveNavKey(pathname)` function
in `nav-model.ts`; test it without a DOM. `app-navigation.tsx` is the only
pathname-aware Client Component and uses `usePathname()`. The Server Component
shell wraps it in Suspense because dynamic governance routes are in scope.

**Rationale**: Active state must update on client navigation without rerunning
presentation logic in every page. Pure matching keeps the critical ordering
testable: `/teams/{id}/policies` and `/objectives` map to Governance before the
broader `/teams` rule maps to Teams. The remainder of the shell stays server
rendered and receives only serializable identity props.

**Alternatives considered**:

- Make the whole shell a Client Component — rejected because it needlessly
  expands the client bundle and risks passing server-only auth dependencies
  across the RSC boundary.
- Match only the first path segment — rejected by FR-004 and the clarification
  for nested governance routes.
- Store active state locally on click — rejected because direct loads,
  back/forward navigation, and nested routes would drift from the URL.

## 6. Use the formalized mockup tokens when private HTML is unavailable

**Decision**: Reproduce the shell from the repository's already-extracted
mockup contract in `docs/context/design-system.md`: 216px/remaining-space grid,
`--panel` sidebar, uppercase mono section labels, 8×10px nav padding, 8px
radius, teal soft active background with a 3px accent bar, and a bottom-pinned
user cell. Use the existing Tailwind token mappings and self-hosted Next fonts.

**Rationale**: The source Claude Design MCP/DesignSync capability and private
HTML files are not available in this session, but the preceding design-token
feature explicitly extracted the shared Audit/Governance shell measurements
and palette into a local source of truth. This preserves the recorded design
without inventing a parallel token system or runtime font link.

**Alternatives considered**:

- Block all implementation on the unavailable private connector — rejected
  because the local design-system artifact contains the exact shell primitives
  this feature needs.
- Copy the legacy frontend navbar — rejected because it predates the approved
  shell design and has different structure/styling.

## 7. Keep destination pages out of scope while making `/dashboard` real

**Decision**: Add a minimal `/dashboard` composition page so the clarified
Overview/default route exists inside the protected route group. It exposes a
semantic content slot and no dashboard widgets or downstream feature behavior.
All other nav links are real `Link` destinations and may resolve to their
owning feature's not-found state until shipped.

**Rationale**: A default route cannot be both canonical and nonexistent. The
minimal page makes auth/layout behavior independently verifiable without
violating FR-006's prohibition on building section content.

**Alternatives considered**:

- Leave `/dashboard` absent — rejected because successful login/default
  navigation would immediately land on a global 404 outside the shell
  contract.
- Build dashboard cards from the legacy app — rejected as downstream page
  content outside this feature.
