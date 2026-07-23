# Project Tenets

*Last updated: 2026-07-20*

These are the governing principles for SkillCanon. Each tenet encodes a constraint the project actually faces — not a style preference, but an invariant that must hold. SkillCanon is moving toward a multi-tenant deployment model with SOC2 compliance in scope, built test-first (red-green-iterate) and organized around domain-driven design.

## Process

**P1 — Red-green-iterate is mandatory for new backend logic**
Every new piece of backend logic starts with a failing test that demonstrates the requirement, then the minimum code to pass it, then refactor with tests green throughout. No production logic lands without a preceding failing test.
*Why:* Backend has no static type checker (documented in CLAUDE.md) — tests are the only correctness signal there is. Writing the test first also forces the tenant-scoping question (pairs with M1) to surface at design time instead of after the fact.

## Architecture — Domain-Driven Design

**D1 — Bounded contexts own their models; no context reaches into another's internals directly**
Organize into explicit modules — e.g. `identity` (users, auth, teams-as-tenant), `governance` (policies, objectives), `registry` (prompts, versions, workflows) — each exposing a service/contract layer. One context talks to another only through that contract, never by importing its ORM models directly.
*Why:* Today `policy_service.py` imports `Team` and `User` straight from a shared `models.py`, and every service can query any model directly. That's exactly the seam that makes tenant isolation (which must apply uniformly across all of these) hard to enforce consistently — a contract boundary is where you'd enforce "every governance query is tenant-scoped," once.

**D2 — Domain invariants live in the aggregate/service layer, not in routers**
Rules like "a policy's tenant is derived from its team, never accepted as a separate input" belong to the domain model or its service, not re-implemented per HTTP handler.
*Why:* `routers/policies.py`'s `_authorize_policy_team` is real business logic sitting in a router file. As bounded contexts form, logic like this has to live where every entry point — REST *and* MCP — gets it automatically, instead of being re-derived (or forgotten) per endpoint.

## Multi-Tenancy

**M1 — Every tenant-scoped table and query is scoped by tenant_id; the root Team is the tenant**
Every non-global row (prompts, policies, objectives, projects, api keys, usage records, workflows...) carries a tenant_id or is resolvable to one via a required join, and every service-layer query filters by the caller's tenant_id — never trust a path- or body-supplied ID alone as sufficient.
*Why:* `policy_service.py`'s `get_policy`/`update_policy`/`delete_policy` currently query by `policy_id` alone with zero tenant check — in today's single-org world that's low-stakes, but it's the exact shape of a cross-tenant data leak the moment a second tenant exists on the same instance.

**M2 — Postgres Row-Level Security is a backstop, not the primary control**
RLS policies are enabled on every tenant-scoped table so a bug in app-layer scoping still can't return another tenant's rows. The app layer remains the primary tenant model and what tests target directly; RLS is defense-in-depth, not a substitute for M1.

**M3 — Every resource type has a negative test proving cross-tenant access is denied**
For each tenant-scoped resource, at least one test asserts that a user in tenant A cannot read or write a resource belonging to tenant B by ID — not just that it's absent from A's list view.
*Why:* This is where P1 (TDD) and M1/M2 (isolation) meet — "strong separation" isn't actually established until there's a failing-then-passing test per resource type that tries to cross the boundary and can't.

## Security

**S1 — Secrets are hashed at rest, never stored reversibly**
Passwords (bcrypt) and API keys (SHA-256) are hashed; only a short display prefix may exist unhashed.
*Why:* Already correct in `auth_service.py` / `apikey_service.py` — this tenet locks the pattern in against regression.

**S2 — Untrusted template content only renders through the sandboxed Jinja2 environment**
Prompt templates are user-authored and rendered at runtime; always via `SandboxedEnvironment` + `StrictUndefined` + the `MAX_INCLUDE_DEPTH` guard, never the default `Environment`.
*Why:* `prompt_service.py` already does this — a template-injection boundary worth protecting explicitly, especially once tenants share an instance.

**S3 — Secrets never appear in logs, even truncated**
No log statement includes any portion of a raw API key, JWT, or password.
*Why:* `mcp/tools.py` currently logs `api_key_raw[:12]` at debug level — real key material, today, in the logs.

## Compliance (SOC2)

**C1 — Every mutation and every cross-tenant-sensitive read is captured in an audit log, on every transport**
Independent of general usage metrics: who, what, when, on which tenant/resource — for REST *and* MCP alike.
*Why:* `mcp/tools.py`'s `sh_run` — the primary way this product is actually used per the README — never calls `record_usage`, while the REST `/expand` path does. That gap is exactly what SOC2 audit-logging controls require closed, and project.md already flags audit logging as "manual review only, no automated check."

**C2 — All traffic is encrypted in transit; nothing security-critical ships with a functional insecure default**
TLS everywhere outside local dev; startup fails loudly if `jwt_secret`/`auth_token` are still at their placeholder values, and environment-specific config (CORS origins, hosts) comes from settings, never a hardcoded literal.
*Why:* `config.py` ships a functional dev JWT secret with no check that it was changed, and `main.py` hardcodes `allow_origins=["http://localhost:3000"]` — the Helm chart already supports a real ingress host, but CORS would silently break it today.

## Productization

**G1 — Every feature ships behind an entitlement gate**
Every new feature — a UI surface, a REST route, an MCP tool — is gated by a checked entitlement flag before it does real work. Free vs. Paid (and future custom-override) availability is controlled by flipping an entitlement value via `resolveEntitlements()`, never by a separate code branch, a separate deploy, or a fork. A feature merged without a corresponding entitlement key is incomplete, not just under-configured.
*Why:* PDR-004 already established entitlements as per-org data specifically so tier boundaries can move without a redeploy. A feature that ships without a gate defeats that design and creates a retrofit debt — and a real risk of a Paid-only feature quietly being available to Free (or vice versa) — the moment product wants to change packaging, which is expected to happen often before pricing stabilizes.
