# Epic 000: Foundations

**Priority:** 0
**Status:** not-started
**Goal:** Establish the decisions and written conventions every subsequent epic builds on, so implementation doesn't stall on undecided questions mid-feature.

## Overview

`context/architecture.md` and `spec/tenets.md` already settled the big structural calls (bounded contexts, multi-tenancy from day one, Drizzle, AWS, entitlements-as-data). What's left are the concrete, written-down conventions that every epic from 001 onward needs to already have an answer for — how migrations are named, what an error response looks like, how a tenant-isolation test is structured, what "done" means for CI. These aren't features; each one is a decision or a piece of research that produces a permanent reference doc in `context/`.

None of epic 001 (TypeScript Refactor Foundation) should start until items 001, 002, and 003 below are resolved — the app scaffold, DB client, and CI pipeline are built directly on those answers.

## Features

- [ ] [001 - Repo Structure & Module Boundaries](001-repo-structure-and-module-boundaries.md)
- [ ] [002 - Database Schema & Tenancy Conventions](002-database-schema-and-tenancy-conventions.md)
- [ ] [003 - Testing Strategy](003-testing-strategy.md)
- [ ] [004 - API & Error Conventions](004-api-and-error-conventions.md)
- [ ] [005 - Deployment, Environments & AWS Topology](005-deployment-environments-and-aws-topology.md)
- [ ] [006 - Auth & Session Conventions](006-auth-and-session-conventions.md)
- [ ] [007 - Entitlement Catalog](007-entitlement-catalog.md)
- [ ] [008 - Third-Party Service Selection](008-third-party-services.md)

*Completed items are moved to `archive/` and checked off here.*

## Dependencies

None — this is the starting point. Draws on `context/architecture.md` and `spec/tenets.md`, both already written.

## Notes

Items 001–003 block epic 001. Items 004–008 can happen in parallel with epic 001 but must land before the epic that needs them (006 before 002-identity-access; 007 and 008 before 008-billing-entitlements).
