import { type AnyPgColumn, text, unique, uuid } from "drizzle-orm/pg-core";
import { id, organizationId, timestamps } from "@/shared/db/columns";
import { identityAccessSchema } from "@/shared/db/schemas";

/**
 * The tenant-root aggregate (PDR-003) — unlike every other table in this
 * system, it carries no `organization_id` column and no RLS policy, since
 * it defines the tenant boundary rather than living inside one (see
 * data-model.md and plan.md's Constitution Check).
 *
 * `plan_id`/`stripe_customer_id` are nullable with no FK constraint yet —
 * `billing.plans` doesn't exist until epic 008 (research.md §4).
 */
export const organizations = identityAccessSchema.table("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  planId: uuid("plan_id"),
  stripeCustomerId: text("stripe_customer_id"),
  ...timestamps(),
});

/**
 * A node in one organization's recursive team hierarchy (006-team-hierarchy).
 * `slug` is unique per-organization, not globally (FR-002) — correcting the
 * current Python schema's global uniqueness, the same class of bug PDR-003
 * exists to prevent. `owner_id` has no FK yet: `identity_access.users`
 * doesn't exist until feature 003 (research.md §1). No RLS policy yet either
 * — deferred to 007-tenant-isolation-tests-and-rls.md, which already
 * depends on this feature (plan.md's Complexity Tracking).
 */
export const teams = identityAccessSchema.table(
  "teams",
  {
    id: id(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    ownerId: uuid("owner_id"),
    parentTeamId: uuid("parent_team_id").references(
      (): AnyPgColumn => teams.id,
    ),
    ...timestamps(),
  },
  (table) => [unique().on(table.organizationId, table.slug)],
);
