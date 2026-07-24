# Feature Specification: App Shell & Navigation

**Feature Branch**: `013-app-shell-navigation`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "backlog/004-app-shell-and-landing/002-app-shell-and-navigation.md"

## Clarifications

### Session 2026-07-23

- Q: When a signed-in user is deactivated, what happens to their existing session? → A: Treat it as invalid on the next request and redirect to login.
- Q: Which route should “Overview” link to and use as the default authenticated destination? → A: `/dashboard`.
- Q: For nested routes such as `/teams/{teamId}/policies` and `/teams/{teamId}/objectives`, which nav item should be active? → A: Governance for policies/objectives; Teams for team administration.
- Q: Where should the top-level Governance nav link take the user? → A: `/teams/{currentTeamId}/policies`.
- Q: If an authenticated user’s organization lacks `coreFeaturesEnabled`, what should an app route display? → A: An access-unavailable page without the app shell.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Only active authenticated users can access app pages (Priority: P1)

Anyone without a valid signed-in session, including a deactivated user presenting a previously issued session, who requests a page inside the authenticated app (dashboard, governance, teams, settings, etc.) is redirected to login instead of seeing any protected content.

**Why this priority**: This is the security gate every downstream feature depends on. Until it's correct, no other part of the app shell — or any page composed into it — can be trusted to be private.

**Independent Test**: Request an authenticated app route with no session, with an expired/invalid session, and with a previously issued session belonging to a now-deactivated user; confirm each is redirected to login with no protected content ever rendered. Request the same route with a valid session for an active user and confirm it renders.

**Acceptance Scenarios**:

1. **Given** no session, **When** a user requests any authenticated app route, **Then** they are redirected to the login page and never see app content.
2. **Given** an expired or otherwise invalid session, **When** a user requests any authenticated app route, **Then** they are redirected to login the same as if they had no session at all.
3. **Given** a previously issued session for a user who has since been deactivated, **When** they next request an authenticated app route, **Then** the session is treated as invalid and they are redirected to login before protected content is returned.
4. **Given** a valid session for an active user, **When** the user requests an authenticated app route, **Then** the app shell renders and the requested page's content loads inside it.
5. **Given** a valid session for an active user whose organization lacks `coreFeaturesEnabled`, **When** the user requests an authenticated app route, **Then** an access-unavailable page renders without the app shell or protected page content.

---

### User Story 2 - Authenticated users navigate the workspace via a persistent shell (Priority: P2)

A signed-in user sees a left navigation grouped into "Workspace" and "Settings" sections, can move between the sections other features compose into, and can always tell which section they're currently in.

**Why this priority**: This shell is the single, shared entry point every downstream bounded context's own UI feature composes its pages into. Without a correct, consistent nav, none of those features have anything real to attach to.

**Independent Test**: Render the shell with a stub page under each nav destination in turn and confirm only the corresponding nav item shows the active state.

**Acceptance Scenarios**:

1. **Given** the app shell displaying a page composed under a nav item, **When** rendered, **Then** that nav item shows the active state and no other item does.
2. **Given** a user navigates to a different nav destination, **When** the new page loads, **Then** the shell re-renders with only the new item marked active.
3. **Given** a user viewing the shell, **Then** the "Workspace" section lists Overview, Prompts, Governance, Teams, Workflows, Projects, and Metrics, and the "Settings" section lists API keys and Audit log.
4. **Given** a user selects Overview or completes login, **When** the app chooses the default authenticated destination, **Then** it navigates to `/dashboard`.
5. **Given** a user views a nested policy or objective route under `/teams/{teamId}`, **When** the shell renders, **Then** Governance is the only active nav item; on team-administration routes, Teams is the only active item.
6. **Given** an authenticated user whose current team is known, **When** they select Governance, **Then** they navigate to `/teams/{currentTeamId}/policies`.

---

### User Story 3 - Signed-in user sees their own identity in the shell (Priority: P3)

An account footer in the shell shows the signed-in user's avatar-initial, display name, and role/team, so they always know which account they're using without leaving the current page.

**Why this priority**: Lower priority than the auth gate and navigation themselves, but still real, visible user value confirming identity — and it matches the account-footer convention already established in the source mockups.

**Independent Test**: Render the shell for a known authenticated session and confirm the footer shows that user's own initial, name, and role/team — not placeholder data.

**Acceptance Scenarios**:

1. **Given** an authenticated session for a known user, **When** the shell renders, **Then** the account footer shows that user's avatar-initial, name, and role/team subtext.
2. **Given** an authenticated session, **When** the account footer's chevron affordance is present, **Then** it visually signals further account actions are available (wiring those actions is out of this feature's scope — see Assumptions).

---

### Edge Cases

- What happens when a user's session expires while they're actively viewing an app page (not at the initial request)? The next navigation or request re-evaluates the session and redirects to login, the same as any other invalid session — this feature does not need a live/in-page expiry notification.
- What happens when a signed-in user's account is deactivated while they are actively viewing an app page? Their previously issued session is treated as invalid on the next navigation or request and they are redirected to login; no live/in-page deactivation notification is required.
- What happens when an authenticated user's organization does not have the app shell's required entitlement? The user remains authenticated but sees an access-unavailable page without the shell, navigation, or protected page content; they are not redirected to login.
- What happens when the current URL is a nested detail page rather than a nav item's direct destination? The owning product section stays active: `/teams/{teamId}/policies` and `/teams/{teamId}/objectives` activate Governance, while team-administration routes activate Teams, regardless of their shared `/teams` prefix.
- What happens when a user follows a nav link to a section whose own page feature hasn't shipped yet? The shell still renders the link and routes to it; what happens next (e.g., a not-found page) is that section's own owning feature's responsibility, not this one's.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST require a valid authenticated session belonging to an active user for every route inside the authenticated app area; requests without one MUST be redirected to login before any protected content is returned.
- **FR-002**: System MUST treat an expired or otherwise invalid session, including a previously issued session whose user has since been deactivated, identically to a missing session — redirected to login, with no protected content rendered first.
- **FR-003**: System MUST render a persistent left navigation with two labeled sections: "Workspace" (Overview at `/dashboard`, Prompts, Governance at `/teams/{currentTeamId}/policies`, Teams, Workflows, Projects, Metrics) and "Settings" (API keys, Audit log).
- **FR-004**: System MUST visually mark exactly one nav item as active according to the page's owning product section, not merely its first URL segment, and MUST update that state as the user navigates; nested team policy/objective routes map to Governance, while team-administration routes map to Teams.
- **FR-005**: System MUST display an account footer showing the signed-in user's avatar-initial, display name, and role/team subtext.
- **FR-006**: System MUST provide only the shell/chrome (navigation, layout, auth gate) — the content rendered inside each section is supplied by that section's own owning feature composing into the shell, not built by this feature.
- **FR-007**: System MUST render every listed nav item as a real, navigable link regardless of whether the destination section's own page feature has shipped yet.
- **FR-008**: System MUST require the authenticated user's organization to have `coreFeaturesEnabled` before rendering any app route; if the entitlement is absent or disabled, the system MUST render an access-unavailable page without the app shell, navigation, or protected page content, while preserving the user's authenticated state.

### Key Entities

- **Authenticated Session**: The signed-in user's identity, already established by the existing session-auth capability (`002-identity-access`). This feature consumes a session and the user's current active status to decide access and populate the account footer; it treats a deactivated user's session as invalid but does not create, refresh, or otherwise manage sessions.
- **Nav Section**: A labeled grouping of nav items ("Workspace", "Settings"), each item pointing at a route owned by a specific bounded context's own UI feature.
- **Core Feature Entitlement**: The organization's `coreFeaturesEnabled` value, consumed after authentication to decide whether the app shell and protected page content may render.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of requests to an authenticated app route without a valid session for an active user — including requests from a deactivated user presenting a previously issued session — are redirected to login, with zero protected content returned.
- **SC-002**: On every composed page, a user can identify their current location from the nav's active-item highlight alone, with no ambiguous or multi-highlighted state.
- **SC-003**: Every downstream bounded context's own UI feature can compose its page into the shell without building any of its own navigation, layout, or auth-gating code.
- **SC-004**: A signed-in user can identify which account they're using (name, role, team) without leaving the current page.
- **SC-005**: 100% of authenticated app-route requests from organizations without `coreFeaturesEnabled` receive the access-unavailable page, with zero app-shell navigation or protected page content rendered.

## Assumptions

- **Nav composition resolves the source mockups' disagreement**: `SkillCanon Governance.dc.html`'s nav (Overview / Prompts / Governance / Teams / Workflows / Projects / Metrics) is used, not `SkillCanon Audit.dc.html`'s shorter one (which omits "Projects" and calls the prompt item "Skills"). Confirmed against `src/bcs/prompt-registry/OWNERSHIP.md`, which owns both `/prompts/*` and `/projects/*` as distinct routes — "Prompts" matches the bounded context's actual name and route, "Skills" does not. Audit's mockup is the earlier/incomplete one.
- **Login page target**: unauthenticated redirects point at a `/login` route. This feature does not build that page's content — it's owned by `008-distribution`, which depends on epic `002-identity-access` (already complete). The redirect itself is correct behavior even before that page exists to render.
- **No return-to-original-destination after login**: after signing in, a user lands on `/dashboard`, the default authenticated Overview page, rather than being returned to whatever page they originally requested pre-redirect.
- **Account footer's chevron has no required behavior yet**: the originating backlog item only specifies the footer's display elements (avatar-initial, name, role/team, chevron), not a fully wired account/sign-out menu. Building that menu's actual actions is not in this feature's scope.
- **Nav items for not-yet-built sections are still real links**: visiting one before its owning feature ships is expected to be incomplete (e.g., 404) — that's the responsibility of each section's own feature, not this one.
- **Core feature entitlement defaults to enabled**: `coreFeaturesEnabled` currently defaults to enabled for both Free and Paid organizations, but the shell still checks it explicitly as required by the project constitution; the access-unavailable state covers a missing or disabled value without conflating entitlement denial with authentication failure.
