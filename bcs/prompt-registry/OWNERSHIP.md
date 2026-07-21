# Prompt Registry — Ownership

**Owner:** Ben Anderson

## Folder Ownership

| Path | Ownership level |
|---|---|
| `/bcs/prompt-registry/` | Full |
| `src/bcs/prompt-registry/` (expansion engine, application services) | Full |
| `src/app/(app)/prompts/*`, `/projects/*` (UI) | Full |

## Database Ownership

Postgres schema: `prompt_registry`

| Schema / Table | Notes |
|---|---|
| `prompt_registry.projects` | Owned by a team (Identity); has cross-team members |
| `prompt_registry.project_members` | |
| `prompt_registry.prompts` | `(organization_id, name)` unique |
| `prompt_registry.prompt_versions` | Immutable once created — append-only |
| `prompt_registry.prompt_shares` | |

## Shared Resource Ownership

None.

## Dependencies (owned by others)

| Resource | Owned by BC |
|---|---|
| `resolveEffectivePolicies`, `resolveAllPolicies`, `resolveEffectiveObjectives` | Governance |
| `getTeamChain`, user/team existence | Identity & Access |
| Entitlement checks (e.g. version retention limits) | Billing & Entitlements |
