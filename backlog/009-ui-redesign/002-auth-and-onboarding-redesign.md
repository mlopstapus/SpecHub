---
epic: 009-ui-redesign
feature: 002-auth-and-onboarding-redesign
status: open
dependencies: ["001-design-tokens-and-theming.md"]
---

# Auth & Onboarding Redesign

Apply the Claude design mockups to every page a user sees before they're inside the authenticated app shell: login, register, invite acceptance, and first-run/welcome. These are the first impression of the product and the highest-leverage pages for this epic.

## Requirements

- [ ] `login` redesigned per mockups
- [ ] `register` redesigned per mockups
- [ ] `invite/[token]` (accept-invite) redesigned per mockups
- [ ] `welcome` (first-run/onboarding) redesigned per mockups
- [ ] All four pages use the token system from `001-design-tokens-and-theming.md` exclusively — no ad hoc styling

## Acceptance Criteria

- [ ] Each page visually matches its corresponding Claude design mockup
- [ ] No behavioral regression: login, registration, invite-accept, and first-run flows still function exactly as built in `002-identity-access` (003-user-accounts-and-registration, 004-jwt-session-auth, 005-invitations) and composed in `007-distribution/003-web-ui-shell-and-core-pages.md`
- [ ] Responsive at mobile/tablet/desktop breakpoints

## Open Questions

- None currently.

## Dependencies

- `001-design-tokens-and-theming.md`

## Technical Notes

Pure restyle — do not change form validation, routing, or session logic while touching these pages. If a mockup implies a UX change (e.g. a different registration flow), flag it rather than silently implementing it here.
