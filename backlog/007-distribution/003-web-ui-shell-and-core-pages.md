---
epic: 007-distribution
feature: 003-web-ui-shell-and-core-pages
status: open
dependencies: ["001-rest-api-core-routes.md", "backlog/000-foundations/006-auth-and-session-conventions.md"]
---

# Web UI Shell & Core Pages

Rebuild the frontend (currently `frontend/src/app/*`) against the new REST API, per the architecture session's "rebuild alongside" decision — not a preserve-and-repoint of the existing pages, but a fresh build using the same shadcn/Tailwind design system carried forward unchanged.

## Requirements

- [ ] App shell/layout (nav, auth-gated routing) composing the individually-owned settings pages from other BCs (billing settings, audit log, etc. — each page's content owned by its BC per that BC's OWNERSHIP.md, composed here)
- [ ] Core pages ported: login/register, teams, projects, prompts (list/detail/new), policies, objectives, workflows (list/detail/new), settings (api-keys, org/team management)
- [ ] Session auth via the httpOnly JWT cookie from `002-identity-access/004-jwt-session-auth.md`
- [ ] shadcn/Tailwind design system carried forward — no new design tokens/branding introduced as part of this feature

## Acceptance Criteria

- [ ] Every core workflow available in the current frontend (create/view/edit a prompt, policy, objective, workflow, team, project) is available in the rebuilt UI
- [ ] Unauthenticated access to any `(app)` route redirects to login
- [ ] Manual smoke test: create a team → create a project → create a policy → create a prompt → expand it via the UI, confirms the applied policy appears in the result

## Open Questions

- Exact page-by-page parity list — worth a quick audit against the current `frontend/src/app/*` tree at implementation time to make sure nothing is missed.

## Dependencies

- `001-rest-api-core-routes.md`
- `backlog/000-foundations/006-auth-and-session-conventions.md`

## Technical Notes

This is the largest UI feature in the backlog — during implementation, consider whether it's worth splitting into per-resource sub-tasks (mirroring `001-rest-api-core-routes.md`'s note) even though it's tracked as one feature file here.

**Forward-pull note (2026-07-23)**: `003-audit-compliance/003-audit-log-ui.md` already built a minimal, audit-log-scoped standalone shell (nav + page chrome) ahead of this feature, so the real audit trail UI could exist by the end of epic 003 rather than waiting on this one. When this feature builds the real app shell, absorb/generalize that nav (it was lifted from the same Claude design mockup, `SkillCanon Audit.dc.html`) into the shell built here and delete the standalone copy — don't maintain two shell implementations side by side. Same applies to the minimal session-auth-in-Next.js-middleware wiring that feature added first: reuse/generalize it here rather than building a second one.
