# Epic 002: Identity & Access

**Priority:** 2
**Status:** not-started
**Goal:** Port tenancy, team hierarchy, users, auth, invitations, and API keys from the current Python backend into the new TS bounded context — establishing the Organization tenant root that every other context depends on.

## Overview

This is the first bounded-context port and the epic every other epic depends on for org/user/team identifiers. It's also where multi-tenancy actually gets built (PDR-003) — the current Python schema conflates "organization" with the root `Team` row and has globally-unique `email`/`username`/`name` constraints that don't survive a second tenant; this epic corrects both. It's also where the reusable M3 cross-tenant-denial test helper gets built, since every subsequent BC epic's own tenant-isolation-tests feature depends on it existing.

## Features

- [X] [001 - Organization Tenant Model](archive/001-organization-tenant-model.md)
- [x] [002 - Team Hierarchy](002-team-hierarchy.md)
- [ ] [003 - User Accounts & Registration](003-user-accounts-and-registration.md)
- [ ] [004 - JWT Session Auth](004-jwt-session-auth.md)
- [ ] [005 - Invitations](005-invitations.md)
- [ ] [006 - API Keys](006-api-keys.md)
- [ ] [007 - Tenant Isolation Tests & RLS](007-tenant-isolation-tests-and-rls.md)

*Completed features are moved to `archive/` and checked off here.*

## Dependencies

- `backlog/001-typescript-refactor-foundation/EPIC.md` (full epic — needs the scaffold, DB kernel, and CI)
- `backlog/000-foundations/006-auth-and-session-conventions.md`

## Notes

Feature 007 (tenant isolation tests) should land alongside 001–006, not after — it's what proves M1/M2/M3 actually hold for this BC's own tables, and it's where the reusable cross-tenant test helper other epics will import gets built.
