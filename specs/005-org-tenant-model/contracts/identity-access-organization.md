# Contract: Identity & Access — Organization surface

This feature adds the following to `src/bcs/identity-access/index.ts` (the BC's only public surface, per `context/repo-structure.md`). `bcs/identity-access/CONTRACT.md` is updated in the same change, per its own Breaking Change Policy.

## `getOrganization(organizationId: string): Promise<OrgSummary>`

Reads one organization by id. Returns the `OrgSummary` shape only (never the raw row — no `stripe_customer_id`, no timestamps). Throws if no organization with that id exists.

**Consumers**: All bounded contexts (per `CONTRACT.md`), plus any future route handler in `src/app/`.

## `bootstrapOrganization(db, params, provisionTeamAndAdmin): Promise<{ organizationId: string; teamId: string; userId: string }>`

```ts
interface BootstrapOrganizationParams {
  name: string;
  slug: string;
}

type ProvisionTeamAndAdmin = (
  tx: unknown, // same transaction as the Organization insert
  organizationId: string,
) => Promise<{ teamId: string; userId: string }>;
```

Runs inside one transaction:
1. Acquires an advisory lock scoped to organization bootstrap.
2. If `isSelfHosted()` and at least one organization already exists, throws `SecondOrganizationNotAllowedError` — no row is written.
3. Inserts the `Organization` row.
4. Calls `provisionTeamAndAdmin(tx, organizationId)` and returns its result alongside the new `organizationId`.

If `provisionTeamAndAdmin` throws, the entire transaction (including the Organization insert) rolls back.

**Consumers**: Not currently called by any route — this feature adds the function but not the registration endpoint that will call it (that lands with feature 003, User Accounts & Registration, which supplies a real `provisionTeamAndAdmin`). Added to `CONTRACT.md`'s Exposed APIs table now so the contract exists before its first real caller, matching how `createTeam`/`createUser`/etc. are already listed there for Distribution's future route handlers.

## Not exposed

`createOrganization` (the guard + insert used internally by `bootstrapOrganization`) stays internal to `application/` — not re-exported from `index.ts`. No update or delete operation is exposed for `Organization` (FR-009) — creation and reads only.
