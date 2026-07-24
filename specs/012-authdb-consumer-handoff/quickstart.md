# Quickstart: Verifying AuthDB Consumer Handoff

This feature has no running application surface to start — it's a documentation/reference change. Validation is a read-through, not a runtime test.

## Prerequisites

- Repo checked out at this branch (`012-authdb-consumer-handoff`).

## Validate: the consolidated reference exists and is accurate

1. Open `src/bcs/identity-access/CONTRACT.md`.
2. Confirm a "Connection Requirements" section exists, listing exactly these functions as requiring `authDb`:
   - `login`
   - `authenticateSession`
   - `authenticateApiKey`
   - `acceptInvitation`
   - `logout` (with its own distinct reason: the indirect `getUser` call, not "same as the others")
   - `bootstrapOrganization` / `registerFirstRunAdmin` (org-bootstrap)
3. Confirm every function listed there also carries a matching **Must be called with `authDb`** note on its own row in the Exposed APIs table above — the two must agree; if they diverge, that's a defect in this feature's own deliverable.

**Expected outcome**: all six functions appear in both places, with `logout` legible as its own line item rather than folded into the group.

## Validate: the forward-dependency tracking notes are correct

1. Open `backlog/008-distribution/001-rest-api-core-routes.md` — confirm it references `backlog/002-identity-access/008-authdb-consumer-handoff.md` and `CONTRACT.md`'s per-function notes for `authenticateSession`, `login`, `authenticateApiKey`, `acceptInvitation`, `logout`, and org-bootstrap.
2. Open `backlog/008-distribution/002-mcp-server-and-tools.md` — confirm it references the same for `authenticateApiKey`.

**Expected outcome**: both files already carry this note (added ahead of this feature); this step is a verification, not expected to require an edit.

## Validate: a reviewer can use this unaided (Success Criteria SC-003)

Give someone unfamiliar with this feature's history only the `CONTRACT.md` "Connection Requirements" section and a hypothetical PR diff calling one of the six functions with the ordinary `db` instead of `authDb`. They should be able to flag the mistake without asking the implementer why.

## Out of scope for this quickstart

Verifying that `008-distribution`'s actual route/tool implementation uses `authDb` correctly is **not** part of this feature — no such code exists yet. That check happens as part of `008-distribution`'s own PR review, using the reference this feature produces.
