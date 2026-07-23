# Data Model: Team Hierarchy

## Entity: `Team`

Postgres table `identity_access.teams`. A node in one organization's recursive hierarchy.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | |
| `organization_id` | `uuid` | `not null` (via `shared/db/columns.ts`'s `organizationId()`) | Tenant scope — every query helper requires this as a mandatory argument (M1, matching `005-org-tenant-model`'s FR-008 precedent) |
| `name` | `text` | `not null` | Display name |
| `slug` | `text` | `not null`, unique **per organization** (`(organization_id, slug)`) | FR-002. Corrects today's globally-unique slug |
| `description` | `text` | nullable | |
| `owner_id` | `uuid` | nullable, no FK yet | Pointer to `identity_access.users` (doesn't exist until feature 003 — research.md §1) |
| `parent_team_id` | `uuid` | nullable, self-FK to `teams.id` | Root-level teams have `null` here |
| `created_at` / `updated_at` | `timestamptz` | `not null`, `default now()` | Standard columns |

**Row-Level Security**: Not enabled by this feature (see plan.md's Complexity Tracking) — `007-tenant-isolation-tests-and-rls.md` owns enabling RLS across every `identity_access.*` table, including this one, and already depends on this feature.

**Invariants** (enforced in the application layer, per FR-012 — same regardless of transport):
- `parent_team_id`, if set, must reference a team with the same `organization_id` as the child (FR-009).
- No reparent may make a team a direct or indirect ancestor of itself (FR-010, cycle prevention — research.md §2).
- `(organization_id, slug)` uniqueness is DB-level (FR-002), same pattern as `organizations.slug`.

## Read shape: `TeamChainEntry`

Per `bcs/identity-access/CONTRACT.md`, `getTeamChain`'s stability-guaranteed output element:

```ts
interface TeamChainEntry {
  id: string;       // TeamId (uuid)
  name: string;
  parentTeamId: string | null;
}
```

`getTeamChain(teamId): Promise<TeamChainEntry[]>` returns these ordered self-first, root-last (FR-006/FR-007) — this exact ordering "will not change without a major version bump" per `CONTRACT.md`'s Stability Guarantees, since Governance's resolution correctness depends on it.

## Relationships

- `Team.organizationId` → `Organization.id` (cross-schema-adjacent but same-schema in practice; both live in `identity_access`) — every team traces to exactly one organization.
- `Team.parentTeamId` → `Team.id` (self-referential, same table) — every team traces, via zero or more hops, to a root-level team (`parentTeamId = null`) within its own organization.
- `Team.ownerId` → `User.id` (future FK, feature 003) — currently an unconstrained pointer.
