---
epic: 002-identity-access
feature: 001-organization-tenant-model
status: open
dependencies: ["backlog/001-typescript-refactor-foundation/EPIC.md"]
---

# Organization Tenant Model

Introduce `Organization` as an explicit tenant-root aggregate above `Team`, per PDR-003 — the foundational multi-tenancy decision the whole SaaS business model depends on. Self-hosted installs get exactly one `organizations` row, created at bootstrap; the managed SaaS gets many.

## Requirements

- [ ] `identity_access.organizations` table: `id`, `name`, `slug` (unique), `plan_id` (pointer into `billing.plans`, nullable until epic 008 exists), `stripe_customer_id` (nullable), `created_at`, `updated_at`
- [ ] `Organization` is the root of every `organization_id` foreign key across all seven schemas (this feature defines the table; later features/epics add the FK as their own tables are created)
- [ ] Self-hosted bootstrap: on first run with zero organizations, creates exactly one `Organization` + root `Team` + admin `User` in one transaction (replaces today's `register_admin` behavior, which conflates org creation with team creation)
- [ ] Application-layer guard: self-hosted mode refuses to create a second `Organization` (matches "Free = self-hosted only, one org per install" from the architecture)

## Acceptance Criteria

- [ ] Fresh self-hosted install: first registration creates one org, one root team, one admin user — verified by test
- [ ] Attempting to create a second organization in self-hosted mode is rejected
- [ ] `organizations.slug` uniqueness enforced at the DB level

## Open Questions

- None — this is a direct implementation of PDR-003.

## Dependencies

- `backlog/001-typescript-refactor-foundation/002-drizzle-shared-db-kernel.md`
- `backlog/000-foundations/002-database-schema-and-tenancy-conventions.md`

## Technical Notes

Per `bcs/identity-access/CONTRACT.md`, exposes `getOrganization(organizationId)` returning the `OrgSummary` shape only — never the raw row — to other bounded contexts. Per PDR-003's stated risk, every query helper this and later features build must take `organizationId` as a required argument, never an optional filter.
