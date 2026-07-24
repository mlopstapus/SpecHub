# Contract: Identity & Access — RLS-adjacent signature changes

Updates two entries already listed in `bcs/identity-access/CONTRACT.md`'s "Exposed APIs" table (`getOrganization`, `getUser`) and one (`getTeamChain`) — see data-model.md for the full rationale.

## `getUser(db, userId, organizationId?): Promise<UserSummary>`

- `organizationId` **omitted**: unscoped lookup by id alone (today's existing behavior, unchanged) — throws if `userId` doesn't exist. Reserved for `authenticateSession`'s pre-auth resolution path (no org known yet); any other caller passing no `organizationId` gets the same weaker guarantee and should have a similarly documented reason.
- `organizationId` **given**: looks up via `users-repo.findByOrgAndId(db, organizationId, userId)` instead — throws the *same* error for "doesn't exist" and "exists in a different org" (this BC's established denial convention, research.md §6). This is the expected path for every "All contexts" consumer that already has its own org context.
- Return shape unchanged: `UserSummary` (`id`, `orgId`, `teamId`, `role`, `email`).

## `getTeamChain(db, organizationId, teamId): Promise<TeamChainEntry[]>`

- `organizationId` is now **mandatory** (previously: `getTeamChain(db, teamId)`).
- Starting lookup uses the new `teams-repo.findByOrgAndId(tx, organizationId, teamId)`; throws the same not-found error whether `teamId` doesn't exist or belongs to a different organization.
- Ancestor-chain walk (unchanged): continues via plain `findById`, safe without re-checking org on every step, since `createTeam`/`reparentTeam` already guarantee a team's parent always shares its organization.
- Return shape and ordering guarantee (self-first, root-last) unchanged — still governed by the existing Stability Guarantee in `CONTRACT.md`.

## `getOrganization(db, organizationId): Promise<OrgSummary>`

- **No signature or behavior change.** Documented here so this isn't mistaken for an overlooked case during future review — see data-model.md / research.md §3 for why no second parameter is needed.

## Not part of this contract (no signature change, connection choice only)

`login`, `authenticateSession`, `authenticateApiKey`, `acceptInvitation`, `createOrganization`, `bootstrapOrganization`, `provisionTeamAndAdmin` keep their existing signatures exactly. The only change relevant to a future caller (`007-distribution`'s route handlers) is that these specific functions must be invoked with a connection authenticated as the `skillcanon_auth` role (`shared/db/client.ts`'s new `authDb` export), not the ordinary `db` — see data-model.md's Role summary table. Every other exposed function in this bounded context continues to expect the ordinary `db`/`appDb`-equivalent connection, established per-request via `withTenantContext`.
