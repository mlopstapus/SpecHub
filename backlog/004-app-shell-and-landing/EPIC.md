# Epic 004: App Shell & Landing

**Priority:** 4
**Status:** not-started (being picked up ahead of `003-audit-compliance`'s remaining items — see Notes)
**Goal:** Build and design, for real, the two structural surfaces every later epic's UI depends on — the authenticated app shell (nav/layout every bounded context composes its own pages into) and the public marketing landing page — early enough that every downstream epic, including `003-audit-compliance`'s own remaining UI work, composes its real, finished pages into an already-real shell instead of building a temporary one first.

## Overview

**Why this epic exists, and why here (2026-07-23):** `008-distribution/003-web-ui-shell-and-core-pages.md` originally owned building the app shell, but sits after epics 003 (Audit & Compliance), 005 (Governance), 006 (Prompt Registry), and 007 (Workflow Orchestration) — all of which need to compose their own UI into that shell. `003-audit-compliance/003-audit-log-ui.md` was originally planned to work around that by building its own minimal standalone shell first (an explicitly-flagged one-off, not a repeatable pattern) — but this epic is being built before that plan was ever executed in code, so no standalone shell/tokens ever actually got built to throw away. This epic just goes first instead.

**Confidence the shell design is real and stable, not a guess:** the left-nav/shell markup is not invented for this epic — it already appears near-identically in two independently-produced Claude design mockups (`SkillCanon Audit.dc.html` and `SkillCanon Governance.dc.html`, both in claude.ai/design project `7babdbf3-c063-46b5-84df-ffa9f588d88a`), which is strong evidence it's the intended, consistent shell rather than one page's one-off styling. See `002-app-shell-and-navigation.md`'s Open Questions for the one real inconsistency found between those two mockups (nav item naming/composition) that needs resolving before implementation.

**Session auth middleware**, needed for admin/auth-gated routing, doesn't exist anywhere in this codebase yet — this epic is the first to build it, and every downstream UI feature (starting with `003-audit-compliance/003-audit-log-ui.md`) depends on it directly rather than building its own stand-in.

## Features

- [ ] [001 - Design Tokens & Theming](001-design-tokens-and-theming.md)
- [ ] [002 - App Shell & Navigation](002-app-shell-and-navigation.md)
- [ ] [003 - Marketing Landing Page](003-marketing-landing-page.md)

*Completed features are moved to `archive/` and checked off here.*

## Dependencies

- `backlog/002-identity-access/EPIC.md` (session auth for auth-gated routing; org/user identifiers for the account footer)
- `backlog/000-foundations/010-design-system.md` (deliverable `context/design-system.md` — effectively already answered in practice by the mockups already produced; `001-design-tokens-and-theming.md` formalizes it)

## Notes

This epic absorbs what was originally going to be `008-distribution/003-web-ui-shell-and-core-pages.md`'s shell-building responsibility (that feature is trimmed accordingly — see its own Technical Notes) and what was originally `010-ui-polish-and-accessibility/001-design-tokens-and-theming.md` (that epic's item was moved here in full — see its EPIC.md for the redistribution record).

**Sequencing update (2026-07-23)**: this epic is being implemented before `003-audit-compliance`'s remaining items (002/003) finish, not after, since nothing about the shell/tokens actually depends on audit-compliance finishing first and building the shell here first avoids `003-audit-log-ui.md` ever having to build (and later throw away) a temporary standalone version — see that feature's own updated Technical Notes.

Every downstream BC epic (005-009) gets its own UI feature that composes into this shell and applies its own real, finished design directly (mirroring `003-audit-compliance/003-audit-log-ui.md`'s pattern) — this epic does not itself build governance/prompt-registry/workflow/billing pages, only the shell they compose into and the tokens they all share.
