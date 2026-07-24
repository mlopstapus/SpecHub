---

description: "Task list for AuthDB Consumer Handoff"
---

# Tasks: AuthDB Consumer Handoff

**Input**: Design documents from `/specs/012-authdb-consumer-handoff/`

**Prerequisites**: plan.md, spec.md, research.md, quickstart.md (no data-model.md/contracts/ — see plan.md for why)

**Tests**: Not requested for this feature (spec Assumptions: enforcement is documentation + human review, matching this repo's precedent for the analogous RLS-table review, which also has no automated test).

**Organization**: Tasks are grouped by user story. All three stories converge on the same new `CONTRACT.md` section, so a single Foundational task creates it and each story adds/verifies its own slice — real parallelism is limited by that shared file, noted per task.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Documentation-only feature — no `src/`/`tests/` code paths. Files touched:
- `src/bcs/identity-access/CONTRACT.md`
- `backlog/008-distribution/001-rest-api-core-routes.md`
- `backlog/008-distribution/002-mcp-server-and-tools.md`
- `backlog/002-identity-access/008-authdb-consumer-handoff.md`

---

## Phase 1: Setup

**Purpose**: Confirm the baseline this feature builds on hasn't drifted before adding anything new.

- [X] T001 Verify `src/bcs/identity-access/CONTRACT.md`'s Exposed APIs table rows for `login`, `authenticateSession`, `authenticateApiKey`, `acceptInvitation`, `logout`, `bootstrapOrganization`, `registerFirstRunAdmin` still each carry their existing **Must be called with `authDb`** note unchanged (no edit expected here — this is the baseline the new section in Phase 2 must stay consistent with)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the shared section all three user stories add content to.

**⚠️ CRITICAL**: T002 must complete before any user story task below.

- [X] T002 Add a new `## Connection Requirements` section to `src/bcs/identity-access/CONTRACT.md` (placed after `## Purpose`, before `## Exposed APIs`), with a one-sentence intro explaining it's a consolidated, reviewer-checkable list of every identity-access function requiring the `authDb`-scoped connection (cross-referencing `backlog/002-identity-access/008-authdb-consumer-handoff.md`) — leave the bullet list itself empty, to be filled by T003

**Checkpoint**: Section exists and is ready for content — user story work can begin.

---

## Phase 3: User Story 1 - Implementer picks the right connection on the first try (Priority: P1) 🎯 MVP

**Goal**: A single, explicit, per-function reference exists so an implementer doesn't have to reassemble the requirement from scattered table notes.

**Independent Test**: Trace every function in the new section against `CONTRACT.md`'s existing per-row notes — all six functions appear in both places with matching reasons.

### Implementation for User Story 1

- [X] T003 [US1] Add one bullet per auth-scoped function to the `## Connection Requirements` section in `src/bcs/identity-access/CONTRACT.md`: `login`, `authenticateSession`, `authenticateApiKey`, `acceptInvitation`, `bootstrapOrganization`/`registerFirstRunAdmin` (one combined entry), and `logout` — each stating it requires `authDb` and a one-line reason (depends on T002)
- [X] T004 [US1] Cross-check each bullet added in T003 against its matching per-row note in the Exposed APIs table further down `src/bcs/identity-access/CONTRACT.md`, fixing wording so the two stay consistent (depends on T003)

**Checkpoint**: User Story 1 delivers the core reference — independently reviewable now.

---

## Phase 4: User Story 2 - Reviewer has a concrete checklist item to check against (Priority: P2)

**Goal**: The reference from US1 is actually reachable from where a reviewer will be looking (the `008-distribution` PRs it applies to), and is usable unaided.

**Independent Test**: Given only the `CONTRACT.md` section and a PR diff, a reviewer can correctly judge connection usage without asking the author (quickstart.md's reviewer scenario).

### Implementation for User Story 2

- [X] T005 [P] [US2] Verify `backlog/008-distribution/001-rest-api-core-routes.md`'s existing tracking note (line 15) still accurately names all six functions and correctly points at `CONTRACT.md`; fix wording only if it has drifted (depends on T004)
- [X] T006 [P] [US2] Verify `backlog/008-distribution/002-mcp-server-and-tools.md`'s existing tracking note (line 16) still accurately names `authenticateApiKey` and correctly points at `CONTRACT.md`; fix wording only if it has drifted (depends on T004)
- [X] T007 [US2] Run quickstart.md's "Validate: a reviewer can use this unaided" scenario against the finished `CONTRACT.md` section and record the result in this task's completion note (depends on T005, T006) — **Result: PASS.** Given only the new "Connection Requirements" section and a hypothetical PR calling `login` with plain `db` instead of `authDb`, the mistake is directly catchable from the section text alone, no author context needed.

**Checkpoint**: User Stories 1 AND 2 both hold — the reference exists and is reachable/usable.

---

## Phase 5: User Story 3 - Logout's indirect dependency isn't missed (Priority: P3)

**Goal**: `logout`'s non-obvious requirement has its own standalone, unmissable coverage, not just group inference.

**Independent Test**: Inspect the `logout` bullet in isolation — it reads as a complete, self-contained rule without needing the other five bullets for context.

### Implementation for User Story 3

- [X] T008 [US3] Confirm the `logout` bullet added in T003 is phrased as its own distinct rule (not "same as the others") and explicitly names the internal `getUser` call with no organization context as the reason, in `src/bcs/identity-access/CONTRACT.md` (depends on T003)
- [X] T009 [US3] Check off the now-satisfied Requirements bullet ("`logout`'s indirect dependency... is specifically covered by a test or code-review checklist item, not just inferred from the function list above") in `backlog/002-identity-access/008-authdb-consumer-handoff.md` — leave `status: open` and every other checkbox as-is, since those depend on `008-distribution` code that doesn't exist yet (depends on T008)

**Checkpoint**: All three user stories complete — the handoff reference is whole, reachable, and `logout`'s edge case is explicitly closed.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T010 [P] Run quickstart.md's full validation pass end-to-end (all three "Validate" sections) and record outcome — **Result: PASS** on all three: (1) the six functions all appear in the new section with `logout` as a distinct bullet; (2) both `008-distribution` tracking notes verified accurate, no edit needed; (3) the reviewer-unaided scenario passes (see T007).
- [X] T011 Confirm `specs/012-authdb-consumer-handoff/plan.md`'s Constitution Check "Result: PASS" line still holds after the actual `CONTRACT.md` edit (expected: no change, since this only clarifies an existing, already-correct requirement) — confirmed: no code, no new route/tool/entity was added; Constitution Check remains PASS.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on T001 confirming baseline — BLOCKS all user stories.
- **User Stories (Phase 3-5)**: All depend on T002. US1 (T003-T004) must land before US2 and US3 can verify/confirm content that only exists once US1 writes it — so despite being separate stories, US2 and US3 are sequenced after US1 in practice, not run in true parallel.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T005 and T006 (different backlog files) can run in parallel once T004 is done.
- T010 has no file dependency on T011 and can run in parallel with it.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001) and Phase 2 (T002).
2. Complete Phase 3 (T003-T004) — this alone delivers a usable, consolidated reference.
3. **STOP and VALIDATE**: the reference is internally consistent with `CONTRACT.md`'s existing per-row notes.

### Incremental Delivery

1. Setup + Foundational → section scaffold ready.
2. User Story 1 → reference content complete (MVP).
3. User Story 2 → reference confirmed reachable from `008-distribution`'s own backlog and usable unaided.
4. User Story 3 → `logout`'s edge case explicitly closed, backlog item's Requirements checkbox updated.
5. Polish → full quickstart validation.

---

## Notes

- No code, no tests, no new entities — every task is a documentation edit or a verification read.
- All work lands in one bounded context's contract file plus two already-existing backlog tracking notes; no `008-distribution` code exists yet for this feature to touch (see plan.md's Decision 3 in research.md).
- Commit after each phase checkpoint, not necessarily after every single task, given how small and file-adjacent these edits are.

## Requirement Coverage

Every task above is fully checked off does **not** mean every spec.md requirement is satisfied — four of them describe verifying `008-distribution`'s own future code and PR review, which doesn't exist yet:

- **FR-003**, **FR-004**, **FR-005**, **SC-001** remain open, gated on `008-distribution`'s `001-rest-api-core-routes.md`/`002-mcp-server-and-tools.md` actually being implemented and reviewed against the reference this feature produces. They are **not** achievable by any task in this file.

This mirrors `backlog/002-identity-access/008-authdb-consumer-handoff.md`'s own `status: open` convention — completing this feature's tasks does not archive that backlog item or flip its remaining unchecked boxes.
