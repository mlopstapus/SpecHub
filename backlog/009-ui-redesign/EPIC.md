# Epic 009: UI Redesign

**Priority:** 9
**Status:** not-started
**Goal:** Apply a real visual/UX design pass across every page in the rebuilt app — turning the functional-parity rebuild from epic 007 into a launch-ready product — before go-live.

## Overview

`007-distribution/003-web-ui-shell-and-core-pages.md` explicitly carries the existing shadcn/Tailwind primitives forward unchanged; it rebuilds every page's *behavior* against the new REST API but not its *look*. `003-audit-compliance/003-audit-log-ui.md` and `008-billing-entitlements/003-billing-portal-and-ui.md` add two more pages the same way, composed into that same shell. This epic is the last thing that touches the UI before go-live: it takes the mockups already produced in Claude design and applies them across every one of those pages, so the product that actually ships looks designed rather than merely functional.

It's placed last deliberately, same reasoning as epic 008's placement: redesigning a page is wasted work if that page's behavior/routes still change underneath it. By the time this epic starts, every page's functionality (007, plus 003's and 008's additions) is already built and stable.

## Features

- [ ] [001 - Design Tokens & Theming](001-design-tokens-and-theming.md)
- [ ] [002 - Auth & Onboarding Redesign](002-auth-and-onboarding-redesign.md)
- [ ] [003 - Workspace Redesign](003-workspace-redesign.md)
- [ ] [004 - Governance Views Redesign](004-governance-views-redesign.md)
- [ ] [005 - Prompt Registry Views Redesign](005-prompt-registry-views-redesign.md)
- [ ] [006 - Workflow Views Redesign](006-workflow-views-redesign.md)
- [ ] [007 - Settings & Admin Views Redesign](007-settings-and-admin-views-redesign.md)
- [ ] [008 - Cross-Page Polish & Accessibility](008-cross-page-polish-and-accessibility.md)

*Completed features are moved to `archive/` and checked off here.*

## Dependencies

- `backlog/000-foundations/010-design-system.md` (palette/typography/tokens must be decided before 001 can implement them)
- `backlog/007-distribution/EPIC.md` (every core page must exist and be behaviorally stable first)
- `backlog/003-audit-compliance/003-audit-log-ui.md` (adds the audit-log settings page this epic also redesigns)
- `backlog/008-billing-entitlements/003-billing-portal-and-ui.md` (adds the billing settings page this epic also redesigns)

## Notes

This is a visual/UX pass, not a behavior change — no feature's requirements, routes, or entitlement gating should change as a side effect of a page's restyle. If a redesign surfaces a real UX gap (missing empty state, confusing flow, etc.), track it as a new feature rather than silently expanding scope here.

Policies and objectives have no standalone page in the legacy app (`legacy/frontend/src/app/*`) — they render inline inside `teams`, `projects`, and `welcome`. `007-distribution/003-web-ui-shell-and-core-pages.md` already lists policies and objectives among its core ported pages, so the rebuilt app gives them standalone list/detail views independent of this epic; `004-governance-views-redesign.md` redesigns those once 007 has built them.
