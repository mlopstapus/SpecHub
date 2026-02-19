---
description: Full development lifecycle workflow — from planning through commit
---

# Development Lifecycle Workflow

Use this workflow to move a piece of work from idea to committed code. Follow the steps in order; skip steps only when noted.

## 1. Plan (`/plan`)

- Define scope, tasks, dependencies, and acceptance criteria.
- Output: a plan file in `docs/` (e.g., `docs/plan-<feature>.md`).
- **Skip if:** the task is small and well-understood (e.g., a one-file change).
- **🚧 GATE: Present the plan to the user and WAIT for explicit approval before proceeding.**
  - Ask the user to review the plan and confirm, request changes, or ask questions.
  - Do NOT move to Step 2 until the user says the plan is approved.
  - If the user requests changes, update the plan and re-present for approval.

## 2. Build (`/feature`)

- Implement the feature from the plan or user description.
- Create a feature branch: `feature/<short-description>`.
- Write tests alongside the implementation.

## 3. Harden (loop)

Repeat these as needed until the implementation is solid:

### 3a. Iterate (`/iterate`)

- Improve the implementation based on feedback, test results, or new requirements.
- One concern per cycle; always leave the code working.

### 3b. Fix (`/fix`)

- If a bug surfaces, diagnose the root cause and apply a minimal fix.
- Add a regression test.

### 3c. Refactor (`/refactor`)

- If iteration or fixing reveals structural problems, refactor.
- Ensure tests exist first; behavior must not change.
- **Escalate to `/plan`** if the refactor scope is large.

## 4. Test (`/test`)

- Run the full test suite to confirm all functionality works end-to-end.
- Verify unit, integration, and any e2e tests pass.
- Check code coverage — add tests for any uncovered paths before proceeding.
- If tests fail, loop back to step 3b (`/fix`).

## 5. Review (`/review`)

- Perform a senior-engineer-level code review.
- Check syntax, style, design patterns, performance, and security.
- Address any findings by looping back to step 3.

## 6. Document (`/document`)

- Update or create documentation in `/docs`.
  - New features → `docs/features/`
  - Bug fixes → `docs/bugs/`
- Add code comments where logic is not self-explanatory.
- Run the linter.

## 7. Commit (`/commit`)

- Pull latest, rebase off default branch, resolve conflicts.
- Write a conventional commit message.
- Create a merge request if none exists.

---

## Quick Reference

| Situation | Start at |
|---|---|
| New feature or epic | Step 1 (`/plan`) |
| Small, clear task | Step 2 (`/feature`) |
| Something is broken | Step 3b (`/fix`) |
| "Make this better" feedback | Step 3a (`/iterate`) |
| Tech debt / code smells | Step 3c (`/refactor`) |
| Ready to ship | Step 4 (`/review`) |
