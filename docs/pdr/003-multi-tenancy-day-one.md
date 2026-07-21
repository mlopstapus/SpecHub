# PDR-003: Organization as an Explicit Tenant Root, From Day One

**Status:** Accepted
**Date:** 2026-07-20

## Context

SpecHub's business model is Free (self-hosted, one org per install) plus a managed SaaS/Enterprise offering (many orgs, one shared deployment). The current schema conflates "organization" with the root `Team` row (`register_admin` creates a team and makes it the org). Multi-tenant SaaS needs an explicit tenant boundary that scopes every row, with per-org uniqueness (today `users.email` and `users.username` and `prompts.name` are globally unique, which breaks the moment two different customers' orgs both want a user named "admin" or a prompt named "commit").

## Options Considered

### Keep Team as the tenant root, add SaaS later
Defer the redesign until the SaaS product is actually being built.
Pros: less work now, matches "no hard deadline."
Cons: means a second migration and a second pass through every table's scoping/uniqueness constraints later, on top of live data at that point — the exact kind of foundational, hard-to-reverse decision the architecture process exists to catch before it's expensive.

### Add Organization as an explicit aggregate above Team now
Every table gets an `organization_id`; global uniqueness constraints become `(organization_id, x)` uniqueness; self-hosted installs simply have exactly one `organizations` row.

## Decision

Add `Organization` now, even though it's pre-launch and the SaaS product doesn't exist yet. Every bounded context's tables are organization-scoped from the first migration.

## Consequences

- **Positive:** one codebase and one data model serve both Free (self-hosted) and the managed SaaS without a fork or a later re-migration; uniqueness constraints are correct from day one.
- **Negative:** slightly more ceremony in every query (must always scope by `organization_id`) and every test (must set up an org fixture) even though self-hosted installs never have more than one.
- **Risks:** a missed `organization_id` filter in a query is a cross-tenant data leak once SaaS launches — the single highest-severity bug class this architecture can produce. Mitigation: no context queries another context's tables directly (enforced by the BC contracts in `/bcs/`), and every query helper in `/shared/db/` takes `organizationId` as a required first argument, not an optional filter.
