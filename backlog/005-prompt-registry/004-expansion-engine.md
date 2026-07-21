---
epic: 005-prompt-registry
feature: 004-expansion-engine
status: open
dependencies: ["002-prompt-and-version-model.md", "backlog/004-governance/003-hierarchical-resolution-engine.md"]
---

# Expansion Engine

Port `expand_prompt` from the current Python `prompt_service.py` — template rendering (Jinja2 → Nunjucks per PDR-001's assumption), recursive prompt-inclusion resolution up to `MAX_INCLUDE_DEPTH`, and governance weaving via Governance's read contract only. The second highest-risk port in the refactor, alongside Governance's resolution engine.

## Requirements

- [ ] `expand(orgId, promptName, input, { userId?, projectId?, version? })` returns `{ systemMessage, userMessage, appliedPolicies }` per `bcs/prompt-registry/CONTRACT.md`
- [ ] Calls `resolveAllPolicies`/`resolveEffectiveObjectives` from Governance's contract — **no direct query against `governance.*` tables**
- [ ] Template rendering via Nunjucks in sandboxed mode — matching tenet S2's requirement for untrusted template content (`StrictUndefined`-equivalent, no arbitrary code execution)
- [ ] Recursive prompt-inclusion resolution, bounded by `MAX_INCLUDE_DEPTH`, matching current Python behavior for cycle/depth handling
- [ ] Policy application (prepend/append/inject) applied to system/user templates matching current `_apply_policies` behavior exactly

## Acceptance Criteria

- [ ] **Characterization test suite**: representative prompt/policy/objective/inclusion fixtures run through both the current Python `expand_prompt` and the new TS `expand()`, asserting identical output, before this feature is considered done
- [ ] A template attempting to execute arbitrary code or access an undefined variable is rejected/errors, not silently rendered — proves the sandboxed-rendering requirement (tenet S2)
- [ ] A deeply nested or cyclic inclusion chain is bounded correctly at `MAX_INCLUDE_DEPTH`, matching current behavior
- [ ] Module-boundary lint (from epic 001) passes — no direct import of `governance.*` schema/model files from this feature's code

## Open Questions

- None — behavior fully specified by the existing Python implementation; the job is faithful port plus proven equivalence.

## Dependencies

- `002-prompt-and-version-model.md`
- `backlog/004-governance/003-hierarchical-resolution-engine.md`

## Technical Notes

This is the feature `context/architecture.md` flags as the clearest test of whether Prompt Registry stays decoupled from Governance under real implementation pressure — the current Python code already reaches somewhat informally between these two concerns, and the whole point of the bounded-context split (tenet D1) is that this port must not reproduce that coupling, even though it would be the path of least resistance. Directly implements tenet S2 for the sandboxed-rendering requirement.
