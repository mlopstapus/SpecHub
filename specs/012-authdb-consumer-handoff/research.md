# Research: AuthDB Consumer Handoff

No `[NEEDS CLARIFICATION]` markers remain in `spec.md` (confirmed during `/speckit-clarify`). This phase records the design decisions the plan makes explicit.

## Decision 1: Where the consolidated reference lives

**Decision**: Add a single "Connection Requirements" checklist section near the top of `src/bcs/identity-access/CONTRACT.md`, listing all six auth-scoped functions (plus `logout`'s indirect reason) in one place, in addition to (not replacing) the existing per-row notes already in the Exposed APIs table.

**Rationale**: `CONTRACT.md` is already the established, real source of truth every downstream consumer is pointed at — both `008-distribution` backlog items' tracking notes and the spec's own FR-001 already reference it. A new standalone file would create a second source of truth that can drift out of sync with the per-row notes the first time either one is edited. A consolidated section inside the same file gets reviewer-scannable form without that risk.

**Alternatives considered**:
- New standalone checklist file (e.g. `docs/authdb-checklist.md`): rejected — duplicates information already in `CONTRACT.md`, adds a second place that can go stale.
- PR template checkbox: rejected — no PR template exists in this repo for any review convention, including the analogous RLS-table check; introducing one here would be inventing new process machinery this repo doesn't otherwise use, for a single review item.
- Automated lint/CI check (e.g. a rule flagging `db` instead of `authDb` for the six function names): rejected for this feature's scope — no `008-distribution` code exists yet to lint, and this repo's existing analogous check (new tenant-scoped table needs RLS) is manual review, not automated. Worth reconsidering once `008-distribution` actually has route code, but that's a future decision for that epic, not this one.

## Decision 2: How `logout`'s indirect case gets standalone coverage (FR-002, FR-006)

**Decision**: Give `logout` its own explicit bullet in the new "Connection Requirements" section, phrased as its own rule ("`logout` — internally resolves the user with no organization context via its own `getUser` call") rather than folding it into a single "these six functions all need `authDb`" sentence.

**Rationale**: The whole reason this case is called out separately in the spec (User Story 3) is that it was the one case actually missed once already, precisely because it reads like it should just be "logged out already, no DB lookup needed." A bullet identical in form to the other five removes the risk of a reader skimming past it.

**Alternatives considered**:
- A single automated test asserting `logout` is called with `authDb` in `008-distribution`: not possible yet — no `008-distribution` route code exists for this feature to test. Tracked as a follow-up for whoever implements `008-distribution`'s routes (already noted in that epic's own tracking note), not something this feature can deliver today.

## Decision 3: Scope of "implementation" for this feature

**Decision**: This feature's implementation is the `CONTRACT.md` checklist section plus verifying (not necessarily changing) the two `008-distribution` backlog tracking notes. It does not implement any Distribution route, MCP tool, or test — those don't exist yet.

**Rationale**: Matches the originating backlog item's own framing ("this is a 'make sure a forward dependency doesn't get missed' item, not new design or new code") and the spec's Assumptions section. The feature's Acceptance Criteria (a code review checking `008-distribution`'s actual implementation against `CONTRACT.md`) can only be satisfied once that epic starts — this feature's job is to make sure the reference it will be checked against is as clear as possible before that happens.

**Alternatives considered**: none — this is a direct restatement of already-settled scope from the backlog item and spec, not an open design choice.
