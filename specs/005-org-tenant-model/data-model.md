# Data Model: Organization Tenant Model

## Entity: `Organization`

Postgres table `identity_access.organizations`. The tenant-root aggregate — carries no `organization_id` of its own (it *is* the tenant), unlike every other table in the system.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | Stable, never reused (`bcs/identity-access/CONTRACT.md`'s stability guarantee) |
| `name` | `text` | `not null` | Display name |
| `slug` | `text` | `not null`, **unique** | FR-002. Enforced via a Postgres unique constraint/index — application-level checks alone are not sufficient (SC-003) |
| `plan_id` | `uuid` | nullable, no FK yet | Pointer into `billing.plans` (owned by Billing & Entitlements, epic 008 — table doesn't exist yet, see research.md §4) |
| `stripe_customer_id` | `text` | nullable | Payment-processor customer reference; meaning owned by Billing & Entitlements |
| `created_at` | `timestamptz` | `not null`, `default now()` | Standard column (`shared/db/columns.ts`'s `timestamps()`) |
| `updated_at` | `timestamptz` | `not null`, `default now()` | Standard column; no update path exists yet (FR-009), so this never actually changes post-insert until a future feature adds one |

**Row-Level Security**: *Superseded by `011-tenant-isolation-rls`* — this table now has RLS enabled, with the policy matching the row's own `id` against the session-scoped `app.current_org_id` (rather than an `organization_id` column, which this table still has none of). See `specs/011-tenant-isolation-rls/data-model.md` for the exact policy shape and the `skillcanon_auth` role that legitimately bypasses it for credential-resolution/bootstrap operations. The original reasoning below (this table defining the tenant boundary rather than living inside one) is why the policy predicate differs in shape from every other table's, not why RLS was skipped.

**Invariants**:
- Self-hosted mode (per `isSelfHosted()`, research.md §1): at most one row may ever exist. Enforced in the application layer (`createOrganization`), serialized against concurrent attempts via a Postgres advisory lock (research.md §3) — not a DB constraint, since the same table legitimately holds many rows in SaaS mode.
- `slug` uniqueness: enforced identically in both modes via the DB-level unique constraint.

## Read shape: `OrgSummary`

Per `bcs/identity-access/CONTRACT.md`'s Data Contracts — the *only* shape any other bounded context ever receives:

```ts
interface OrgSummary {
  id: string; // OrganizationId (uuid)
  name: string;
  slug: string;
  planId: string | null; // nullable until Billing exists / a plan is provisioned
}
```

Never the raw row — `stripe_customer_id` and timestamps are Identity & Access-internal.

## Composability seam: `provisionTeamAndAdmin`

Not a persisted entity — a callback type `bootstrapOrganization` accepts, so features 002/003 can plug in real Team/User creation once those tables exist (research.md §2):

```ts
type ProvisionTeamAndAdmin = (
  tx: /* same transaction as the Organization insert */ unknown,
  organizationId: string,
) => Promise<{ teamId: string; userId: string }>;
```

This feature's own tests supply a stub implementation to prove transactional atomicity (FR-004's mechanism); the real implementation and end-to-end wiring land with features 002/003.
