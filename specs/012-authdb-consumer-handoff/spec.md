# Feature Specification: AuthDB Consumer Handoff

**Feature Branch**: `012-authdb-consumer-handoff`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "/Users/ben/repos/SpecHub/backlog/002-identity-access/008-authdb-consumer-handoff.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Implementer picks the right connection on the first try (Priority: P1)

An engineer implementing a Distribution REST route or MCP tool that calls into identity-access (login, session/API-key authentication, invitation acceptance, logout, or org bootstrap) needs to know, without re-deriving the reasoning themselves, which database connection that call requires. Today that reasoning already lives in `bcs/identity-access/CONTRACT.md`'s per-function notes; this story is about that reference actually being consulted and followed the first time a real consumer is built, rather than the wrong connection being discovered later via a production failure.

**Why this priority**: Getting this wrong doesn't fail loudly at review time — it fails at request time, for the exact requests (login, first-run bootstrap) that gate everything else working. This is the highest-value, load-bearing story.

**Independent Test**: Can be tested by tracing every call site in Distribution's implementation that invokes one of the six auth-scoped identity-access functions and confirming each one uses the auth-scoped connection, and every other identity-access call is made only after organization context is resolved.

**Acceptance Scenarios**:

1. **Given** an engineer is implementing a route handler that calls `login`, **When** they write the database call, **Then** they use the auth-scoped connection, not the ordinary tenant-scoped one.
2. **Given** an engineer is implementing a route handler that calls an identity-access function other than the six auth-scoped ones, **When** they write the database call, **Then** they only do so after the request's organization has been resolved, using the tenant-scoped connection bound to that organization.

---

### User Story 2 - Reviewer has a concrete checklist item to check against (Priority: P2)

A code reviewer evaluating a pull request that adds or changes a Distribution route or MCP tool touching identity-access needs a specific, checkable item — equivalent in rigor to this repo's existing convention of checking a newly tenant-scoped table for RLS coverage — rather than relying on memory or a general sense that "auth stuff needs special handling."

**Why this priority**: Even a well-informed implementer can slip on this one detail under normal PR pressure; a review-time check is the backstop that catches it before merge instead of in production.

**Independent Test**: Can be tested by confirming a reviewer, given only the PR diff and `CONTRACT.md`, can correctly identify every connection-usage mistake without needing to ask the author.

**Acceptance Scenarios**:

1. **Given** a pull request touching Distribution's identity-access call sites, **When** it is reviewed, **Then** the review explicitly checks each call site against `CONTRACT.md`'s per-function connection requirement before approval.
2. **Given** a pull request that uses the ordinary connection for one of the six auth-scoped functions, **When** it is reviewed against the checklist, **Then** the mistake is caught and flagged before merge.

---

### User Story 3 - Logout's indirect dependency isn't missed (Priority: P3)

`logout` only ever receives a bare `userId`, with no organization context — but that requirement isn't obvious from the function's name or its public signature the way `login`'s is. This story ensures that specific, easy-to-miss case has its own explicit coverage rather than being left to chance inference from the general rule.

**Why this priority**: Lower priority than the general mechanism (Stories 1-2) because it's a single specific instance of the same underlying rule, but it's called out separately because it was the one case that was actually missed once already, during `logout`'s own migration to real RLS.

**Independent Test**: Can be tested by confirming a test or an explicit, named checklist line item exists that specifically verifies `logout` uses the auth-scoped connection — not just a general note that gets applied by inference.

**Acceptance Scenarios**:

1. **Given** the review checklist or test suite for Distribution's identity-access consumers, **When** it is inspected, **Then** `logout`'s auth-scoped connection requirement appears as its own explicit, named item, distinct from the general six-function list.

---

### Edge Cases

- What happens when a future identity-access function is added that also needs to resolve an identity before any organization context exists? The reference/checklist must be extended to cover it explicitly, not left to go stale while new functions are added.
- How does the review handle a call to one of the six auth-scoped functions made indirectly, through an intermediate Distribution-layer helper, rather than at the route handler itself? The check must trace through to the real call site, not stop at the first layer.
- What happens if the MCP tool surface (`008-distribution`'s `002-mcp-server-and-tools.md`) stays deprioritized and is never built? Then only the REST route surface (`001-rest-api-core-routes.md`) needs review coverage; this feature's scope narrows accordingly rather than being blocked on MCP shipping.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The codebase MUST provide implementers and reviewers with an explicit, per-function reference stating which identity-access functions require the auth-scoped database connection versus the ordinary tenant-scoped one.
- **FR-002**: The reference MUST document `logout`'s auth-scoped connection requirement as its own explicit item, not something a reader has to infer from the six-function list.
- **FR-003**: Every Distribution route handler or MCP tool that calls `login`, `authenticateSession`, `authenticateApiKey`, `acceptInvitation`, `logout`, or org-bootstrap (`bootstrapOrganization`/`registerFirstRunAdmin` — the only two org-bootstrap functions actually exported for Distribution to call; `createOrganization` is an internal helper `bootstrapOrganization` calls and is never callable directly) MUST use the auth-scoped connection for that call.
- **FR-004**: Every Distribution route handler or MCP tool that calls any other exposed identity-access function MUST do so only after the request's organization has been resolved, using the tenant-scoped connection bound to that organization.
- **FR-005**: Before a Distribution route or MCP tool touching identity-access merges, it MUST undergo a review step that explicitly checks its connection usage against the reference from FR-001 — matching this repo's existing review convention for verifying a new tenant-scoped table has RLS coverage.
- **FR-006**: `logout`'s auth-scoped connection requirement MUST be verified by either an automated test or an explicit, named line item in the review step from FR-005 — general inference from the six-function list does not satisfy this.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Distribution's calls to the six auth-scoped identity-access functions use the correct connection, verified before merge rather than discovered afterward.
- **SC-002**: Zero production incidents where an identity or tenant-bootstrap request fails because it used the wrong database connection.
- **SC-003**: A reviewer, given only a pull request diff and the existing reference, can correctly judge every identity-access connection-usage call site without needing to ask the implementer.
- **SC-004**: All six auth-scoped functions, including `logout`'s indirect case, have individually-verifiable coverage (test or named checklist item) — none rely solely on inference from the general rule.

## Assumptions

- The six functions and their required connection are already fully and correctly enumerated in `bcs/identity-access/CONTRACT.md` and `specs/011-tenant-isolation-rls/data-model.md`; this feature does not re-derive or change that enumeration, only ensures it is followed correctly by the first real consumer.
- Enforcement is achieved through documentation plus human code review, consistent with this repo's existing precedent for checking new tenant-scoped tables for RLS coverage — no automated lint or test tooling is assumed necessary, since none exists for that analogous check either.
- Scope covers the two named `008-distribution` consumers (`001-rest-api-core-routes.md` and `002-mcp-server-and-tools.md`). Any other future identity-access consumer added later is out of scope until it exists.
- No new code is required within identity-access itself — `007-tenant-isolation-tests-and-rls` (delivered as `specs/011-tenant-isolation-rls`) already implements `authDb`, the `skillcanon_auth` role, and the `CONTRACT.md` notes this feature depends on.
- "Covered by a test or code-review checklist item" (per the originating backlog item) is satisfiable by either mechanism; this spec does not mandate which one Distribution's implementation ultimately uses.
