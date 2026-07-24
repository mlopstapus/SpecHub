# Tasks: App Shell & Navigation

**Input**: Design documents from `/specs/013-app-shell-navigation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/app-shell-ui.md, quickstart.md

**Tests**: Required by the specification's independent-test scenarios and
Constitution Principle I. Every logic-bearing implementation task follows a
failing test task.

**Organization**: Tasks are grouped by user story so the auth gate, navigation,
and account identity can be validated as incremental slices.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not
  depend on an incomplete task in the same phase.
- **[Story]**: Maps to User Story 1, 2, or 3 in spec.md.
- Every task names its target file path.

## Phase 1: Setup (Contract and Tracking Alignment)

**Purpose**: Record the public bounded-context interfaces and the intentional
future-epic pull-forward before production code depends on them.

- [x] T001 Update the `authenticateSession` app-shell identity shape and `resolveEntitlements`/`hasEntitlement` exposed API signatures in `src/bcs/identity-access/CONTRACT.md` and `src/bcs/billing-entitlements/CONTRACT.md`
- [x] T002 [P] Document the provisional default-backed entitlement facade and remaining persisted-resolution work in `backlog/009-billing-entitlements/004-entitlement-enforcement-integration.md`

---

## Phase 2: Foundational (Shared Contract Types)

**Purpose**: Add the safe, cross-layer types both access enforcement and shell
presentation depend on.

**⚠️ CRITICAL**: User story work starts only after these additive types are
available through their owning bounded-context barrels.

- [x] T003 [P] Add and export the non-secret `AppSessionUser` view type in `src/bcs/identity-access/domain/user.ts` and `src/bcs/identity-access/index.ts`
- [x] T004 [P] Add and export the type-only `EntitlementKey` and `EntitlementSnapshot` contracts in `src/bcs/billing-entitlements/domain/entitlement.ts` and `src/bcs/billing-entitlements/index.ts`

**Checkpoint**: App-layer code can depend on stable Identity and Billing public
types without deep imports.

---

## Phase 3: User Story 1 - Only active, entitled users access app pages (Priority: P1) 🎯 MVP

**Goal**: Reject missing, invalid, expired, and deactivated sessions before
protected rendering; distinguish entitlement denial from authentication; expose
a real `/dashboard` protected composition point.

**Independent Test**: The session, entitlement, and access-state focused tests
prove all three outcomes; an unauthenticated request to `/dashboard` redirects
to `/login` without returning shell or child content.

### Tests for User Story 1

> Write these tests first and confirm they fail before implementation.

- [x] T005 [P] [US1] Extend session integration coverage for deactivated users, live display/team data, and same-organization team resolution in `src/bcs/identity-access/application/authenticate-session.test.ts` (FR-001, FR-002, FR-005, SC-001)
- [x] T006 [P] [US1] Add failing default-catalog and boolean-gate tests in `src/bcs/billing-entitlements/application/resolve-entitlements.test.ts` and `src/bcs/billing-entitlements/application/has-entitlement.test.ts` (FR-008, SC-005, G1)
- [x] T007 [P] [US1] Add failing tests for unauthenticated, entitlement-denied, allowed, and propagated-infrastructure-error states plus structural shell child rendering in `src/app/(app)/app-shell-access.test.ts` and `src/app/(app)/_components/app-shell.test.tsx` (FR-001, FR-002, FR-006, FR-008, SC-001, SC-005)

### Implementation for User Story 1

- [x] T008 [US1] Implement one-query active app-session resolution and return `AppSessionUser` in `src/bcs/identity-access/infrastructure/users-repo.ts` and `src/bcs/identity-access/application/authenticate-session.ts` (depends on T005)
- [x] T009 [P] [US1] Implement the immutable Free defaults plus provisional local `resolveEntitlements` and `hasEntitlement` through the Billing barrel in `src/bcs/billing-entitlements/domain/entitlement.ts`, `src/bcs/billing-entitlements/application/resolve-entitlements.ts`, `src/bcs/billing-entitlements/application/has-entitlement.ts`, and `src/bcs/billing-entitlements/index.ts` (depends on T006)
- [x] T010 [US1] Implement the three-state, dependency-injectable access resolver in `src/app/(app)/app-shell-access.ts` using only Identity and Billing barrels (depends on T007-T009)
- [x] T011 [US1] Implement the structural app shell and child slot plus server-side gating, `/login` redirect, shell-free access-unavailable UI, and minimal protected Overview composition point in `src/app/(app)/_components/app-shell.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/access-unavailable.tsx`, and `src/app/(app)/dashboard/page.tsx` (FR-001, FR-002, FR-006, FR-008)
- [x] T012 [US1] Add failing early-interception tests for redirect, rewrite, and allowed requests in `src/proxy.test.ts` after the layout-only smoke test exposes protected RSC content (FR-001, FR-002, FR-008, SC-001, SC-005)
- [x] T013 [US1] Implement pre-render access interception and the shell-free rewrite target in `src/proxy.ts` and `src/app/access-unavailable/page.tsx`, retaining the layout check as defense in depth
- [x] T014 [US1] Run the US1 focused tests and repeat the unauthenticated `/dashboard` smoke scenario from `specs/013-app-shell-navigation/quickstart.md`, asserting the redirect body contains no protected page or shell text

**Checkpoint**: Protected routing is independently secure and testable before
the visual shell exists.

---

## Phase 4: User Story 2 - Navigate through a persistent workspace shell (Priority: P2)

**Goal**: Render all required real links in the approved two-section shell and
maintain exactly one ownership-aware active state across direct and nested
routes.

**Independent Test**: Pathname mapping tests cover every direct destination,
detail descendants, governance-before-teams precedence, and segment-boundary
false positives; a browser/client navigation updates `aria-current` without
recreating page-owned navigation.

### Tests for User Story 2

> Write these tests first and confirm they fail before implementation.

- [x] T015 [US2] Add failing route-map and active-state precedence tests for all nine nav items in `src/app/(app)/_components/nav-model.test.ts` (FR-003, FR-004, FR-007, SC-002)
- [x] T016 [P] [US2] Add failing server-rendered navigation-list tests for all real hrefs, section labels, and exactly one `aria-current` item in `src/app/(app)/_components/app-navigation.test.tsx` (FR-003, FR-004, FR-007, SC-002)

### Implementation for User Story 2

- [x] T017 [US2] Implement typed nav sections, dynamic Governance href construction, segment-safe matching, and governance-before-teams precedence in `src/app/(app)/_components/nav-model.ts` (depends on T015)
- [x] T018 [US2] Implement a server-renderable navigation list plus pathname-hook client wrapper with Next.js Links and `aria-current` in `src/app/(app)/_components/app-navigation.tsx` (depends on T016-T017)
- [x] T019 [US2] Complete the mockup-derived 216px persistent sidebar, branded header, injectable navigation slot, and min-width-safe content slot in `src/app/(app)/_components/app-shell.tsx` (FR-003, FR-006, SC-003)
- [x] T020 [US2] Pass the Suspense-wrapped pathname navigation into `AppShell` only for the allowed state in `src/app/(app)/layout.tsx`, preserving shell-free authentication and entitlement denial paths (FR-001, FR-008)
- [x] T021 [US2] Run navigation component/model tests plus typecheck/build checks for the composed `/dashboard` route using `specs/013-app-shell-navigation/quickstart.md`

**Checkpoint**: User Stories 1 and 2 work together while downstream destination
features remain independently owned.

---

## Phase 5: User Story 3 - Show the signed-in user's identity (Priority: P3)

**Goal**: Pin a non-placeholder account footer to the shell with the user's
initial, display name, title-cased role, team name, and decorative chevron.

**Independent Test**: Render the account footer from a known `AppSessionUser`
and assert the exact initial/name/role/team output contains no email, raw token,
or placeholder data.

### Tests for User Story 3

> Write this test first and confirm it fails before implementation.

- [x] T022 [US3] Add failing server-rendered footer tests and extend the structural shell test with account-identity composition in `src/app/(app)/_components/account-footer.test.tsx` and `src/app/(app)/_components/app-shell.test.tsx` (FR-005, SC-004)

### Implementation for User Story 3

- [x] T023 [US3] Implement the avatar-initial badge, identity text, role/team separator, and non-interactive chevron in `src/app/(app)/_components/account-footer.tsx` (depends on T022)
- [x] T024 [US3] Pin and populate `AccountFooter` from the allowed `AppSessionUser` in `src/app/(app)/_components/app-shell.tsx` and `src/app/(app)/layout.tsx`
- [x] T025 [US3] Run the account-footer, shell-composition, and complete focused feature tests from `specs/013-app-shell-navigation/quickstart.md`

**Checkpoint**: All three user stories are independently covered and integrated.

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Close the documented future dependency, review React/Next.js
boundaries, and verify the complete implementation.

- [x] T026 Update implementation-status notes for the pulled-forward UI entitlement facade without closing the future persisted Billing work in `backlog/009-billing-entitlements/004-entitlement-enforcement-integration.md` and `specs/013-app-shell-navigation/research.md`
- [x] T027 Review and refine RSC/client boundaries, Suspense usage, semantic nav landmarks, focus visibility, dark-only token usage, and secret-free props across `src/app/(app)/layout.tsx` and `src/app/(app)/_components/*.tsx`
- [x] T028 Run focused tests, full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and the curl smoke test exactly as recorded in `specs/013-app-shell-navigation/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on contract alignment in Phase 1 and
  blocks all story implementations.
- **US1 (Phase 3)**: Depends on Phase 2; is the security MVP.
- **US2 (Phase 4)**: Depends on US1's allowed-state layout composition point.
- **US3 (Phase 5)**: Depends on US2's shell component.
- **Polish (Phase 6)**: Depends on all three stories.

### User Story Dependencies

```text
US1 access gate
  └── US2 persistent shell/navigation
        └── US3 account footer
              └── final verification
```

- **US1** remains independently testable without the visual shell.
- **US2** adds shell/navigation without changing denial behavior.
- **US3** adds identity presentation without changing access or route matching.

### Within Each User Story

- Test tasks must be written and observed failing before production logic.
- Owning bounded-context data/contracts precede app-layer composition.
- The access resolver precedes the Next.js layout.
- Pure pathname mapping precedes the client navigation component.
- Components precede layout integration.

### Parallel Opportunities

- T001 and T002 touch independent documentation.
- T003 and T004 touch different bounded contexts.
- T005, T006, and T007 create independent failing tests.
- After those tests fail, T008 and T009 touch different bounded contexts.
- Static review of US2 components can begin after T018/T019 while US3's footer
  test is being prepared, but shared-file edits to `app-shell.tsx` remain
  sequential.

---

## Parallel Example: User Story 1

```text
Task T005: Session/deactivation integration tests in Identity & Access
Task T006: Default entitlement and gate tests in Billing & Entitlements
Task T007: Three-state access resolver tests in the App Router subtree

After red tests:
Task T008: Identity app-session query/resolution
Task T009: Billing entitlement facade
```

---

## Implementation Strategy

### MVP First

1. Align contracts and add shared types.
2. Write all US1 tests and confirm red.
3. Implement session activity, entitlement resolution, and access-state logic.
4. Add the protected route-group layout and `/dashboard`.
5. Validate redirect/denial/allowed behavior before any shell presentation.

### Incremental Delivery

1. **US1**: Secure protected-route boundary.
2. **US2**: Persistent shell and active navigation.
3. **US3**: Live account identity footer.
4. **Polish**: Cross-story review and full quality gates.

### Format Validation

All 28 tasks use the required checkbox + sequential ID format. Story-phase
tasks carry `[US1]`, `[US2]`, or `[US3]`; setup/foundational/polish tasks do
not. `[P]` appears only where files and dependencies permit parallel work.
