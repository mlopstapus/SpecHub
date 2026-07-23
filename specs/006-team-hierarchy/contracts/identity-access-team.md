# Contract: Identity & Access — Team surface

Adds the following to `src/bcs/identity-access/index.ts`. `bcs/identity-access/CONTRACT.md` already lists `getTeamChain` and `createTeam` in its Exposed APIs table — this feature is what actually implements them; no contract-shape change is introduced (their listed descriptions already match this feature's design).

## `getTeamChain(teamId: string): Promise<TeamChainEntry[]>`

Returns the ordered list of `{ id, name, parentTeamId }` from the given team up to its root, self-first, root-last. Throws if no team with that id exists. Per `CONTRACT.md`'s Breaking Change Policy, this ordering is a stability guarantee — Governance's resolution correctness depends on it never changing without a major version bump.

**Consumers**: Governance (per `CONTRACT.md`).

## `createTeam(tx, params): Promise<{ id: string }>`

```ts
interface CreateTeamParams {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  ownerId?: string;
  parentTeamId?: string;
}
```

Inserts a team. If `parentTeamId` is provided, throws `CrossOrgReparentError` if the parent belongs to a different organization (same invariant reparenting enforces, checked at creation time too — FR-009 applies to the parent link at creation as well as later reparenting).

**Consumers**: Distribution (route handlers), per `CONTRACT.md`'s existing listing.

## `updateTeam(tx, teamId, params): Promise<void>`

```ts
interface UpdateTeamParams {
  name?: string;
  description?: string;
  ownerId?: string;
}
```

Updates only the provided fields. Does not touch `parentTeamId` — that's `reparentTeam`'s job (FR-004 vs FR-008 stay separate operations).

## `reparentTeam(tx, teamId, newParentId): Promise<void>`

Moves `teamId` to a new parent. Enforces, in order: same-organization check (FR-009), cycle check (FR-010, research.md §2), all inside an organization-scoped advisory lock (research.md §3). Throws `CrossOrgReparentError` or `CycleError` on violation — no row changes on either rejection.

## `insertTeamBetween(tx, params, childTeamId): Promise<{ id: string }>`

```ts
interface InsertTeamBetweenParams {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  ownerId?: string;
}
```

Creates a new team taking `childTeamId`'s current parent position, then reparents `childTeamId` under the new team (FR-011). Throws if `childTeamId` doesn't exist.

## `listSubTeams(organizationId, parentTeamId): Promise<TeamSummary[]>`

Lists a team's immediate sub-teams (`parentTeamId` provided) or an organization's root-level teams (`parentTeamId: null`). Not previously listed in `CONTRACT.md`'s Exposed APIs table — added in the same commit as this feature per the Breaking Change Policy.

## Not exposed

`teams-repo.ts`'s raw CRUD functions stay internal to `application/`/`infrastructure/` — not re-exported from `index.ts`. No delete/deactivate operation is exposed (FR-013).
