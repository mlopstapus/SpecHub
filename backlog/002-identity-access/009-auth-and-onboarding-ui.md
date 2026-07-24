---
epic: 002-identity-access
feature: 009-auth-and-onboarding-ui
status: open
dependencies: ["archive/004-jwt-session-auth.md", "archive/005-invitations.md", "backlog/004-app-shell-and-landing/001-design-tokens-and-theming.md"]
---

# Auth & Onboarding UI

The real, finished pages a user sees before they're inside the authenticated app shell — owned by this BC per `bcs/identity-access/OWNERSHIP.md` (`src/app/(auth)/login`, `/register`, `/invite/[token]`, plus first-run/welcome onboarding). Built directly against a real design mockup, same pattern as `003-audit-compliance/003-audit-log-ui.md` and `005-governance/005-governance-views-ui.md`, rather than deferred to a later redesign pass.

**Status (2026-07-23): no Claude design mockup exists yet for these pages.** Pull one via the `claude_design` MCP server and run the same gap-analysis pass against `archive/003-user-accounts-and-registration.md`/`archive/004-jwt-session-auth.md`/`archive/005-invitations.md` before finalizing the Requirements below in detail.

## Requirements

- [ ] Pull the auth/onboarding mockup(s) from claude.ai/design before finalizing the rest of this list
- [ ] `login`, `register`, `invite/[token]` (accept-invite), `welcome` (first-run/onboarding) — page inventory carried over from the now-dissolved `010-ui-polish-and-accessibility` epic's original redesign scope; confirm against the actual mockup once it exists
- [ ] These pages use the token system from `backlog/004-app-shell-and-landing/001-design-tokens-and-theming.md` — no ad hoc styling
- [ ] These pages do **not** use the authenticated app shell from `004-app-shell-and-landing/002-app-shell-and-navigation.md` — they render before/outside it

## Acceptance Criteria

- [ ] Login, registration, invite-accept, and first-run flows still function exactly as built in the archived `003-user-accounts-and-registration`/`004-jwt-session-auth`/`005-invitations` features
- [ ] The page(s) visually match whatever mockup is pulled in
- [ ] Responsive at mobile/tablet/desktop breakpoints

## Open Questions

- Which mockup file(s) cover these pages — none were found alongside the three existing mockups (Audit, Governance, Landing) as of 2026-07-23.

## Dependencies

- `archive/004-jwt-session-auth.md`
- `archive/005-invitations.md`
- `backlog/004-app-shell-and-landing/001-design-tokens-and-theming.md`

## Technical Notes

Pure UI over already-shipped, stable backend logic — do not change form validation, routing, or session logic while building these pages. If a mockup implies a UX change (e.g. a different registration flow), flag it rather than silently implementing it here.
