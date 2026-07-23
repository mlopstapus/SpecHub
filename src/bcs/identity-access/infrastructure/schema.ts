import { text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/shared/db/columns";
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
