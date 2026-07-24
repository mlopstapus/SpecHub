# Epic 006: Prompt Registry

**Priority:** 6
**Status:** not-started
**Goal:** Port Project, Prompt, PromptVersion, PromptShare, and the expansion engine — the second core-domain context — consuming Governance strictly through its read contract, not its internals.

## Overview

The expansion engine (`expand_prompt` in the current Python code) is the other high-risk port alongside Governance's resolution engine — it combines template rendering, recursive prompt-inclusion resolution, and a call into Governance, and today that Governance call reaches somewhat informally into policy/objective services. This epic is where tenet D1 gets proven under real pressure: the temptation to take a shortcut and import Governance's internals for convenience is highest here, precisely because the current Python code already does that.

## Features

- [ ] [001 - Project Model & Membership](001-project-model-and-membership.md)
- [ ] [002 - Prompt & Version Model](002-prompt-and-version-model.md)
- [ ] [003 - Prompt Sharing](003-prompt-sharing.md)
- [ ] [004 - Expansion Engine](004-expansion-engine.md)
- [ ] [005 - Prompt Registry Tenant Isolation Tests](005-prompt-registry-tenant-isolation-tests.md)
- [ ] [006 - Prompt Registry Views UI](006-prompt-registry-views-ui.md)

*Completed features are moved to `archive/` and checked off here.*

## Dependencies

- `backlog/005-governance/EPIC.md` (expansion depends on Governance's resolution contract)
- `backlog/002-identity-access/EPIC.md`
- `backlog/003-audit-compliance/001-audit-event-schema-and-write-path.md`
- `backlog/004-app-shell-and-landing/EPIC.md` (feature 006's UI composes into that epic's shell)

## Notes

Feature 004 must call Governance only through `resolveEffectivePolicies`/`resolveAllPolicies`/`resolveEffectiveObjectives` — reaching into `governance.*` tables directly from this BC is a direct tenet D1 violation and should fail the module-boundary lint check built in epic 001.

**Added 2026-07-23**: feature 006 builds this epic's real UI directly, same pattern as `003-audit-compliance/003-audit-log-ui.md` and `005-governance/005-governance-views-ui.md` — but no design mockup exists yet for these pages, so it's currently a stub pending one (see that feature's Open Questions).
