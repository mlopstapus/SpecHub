# PDR-005: Audit Logging as Core Infrastructure From Day One

**Status:** Accepted
**Date:** 2026-07-20

## Context

Audit logging (who changed what policy/objective/prompt, when) is both a stated Enterprise-tier selling point and something CLAUDE.md already flags as part of SkillCanon's SOC2/NIST compliance scope, currently satisfied only by "review access control, audit logging, and encryption manually." Retrofitting an audit trail after other contexts are built means finding every mutation site after the fact and accepting that anything shipped before the retrofit has no history.

## Options Considered

### Defer until Enterprise tier is actively being built
Build the rewrite without an audit trail, add it later as a dedicated feature.
Pros: less work in the initial rewrite.
Cons: every mutation site across every context has to be found and patched later; no historical data for anything shipped in between; directly contradicts the existing CLAUDE.md compliance note, which already expects audit logging to exist.

### Build it in from day one as a cross-cutting capability
One `record()` call at the application-service boundary of every command, in every context, from the first commit.

## Decision

Build Audit & Compliance as one of the seven bounded contexts from the start, with `record()` called transactionally alongside every mutating command (see `bcs/audit-compliance/CONTRACT.md`).

## Consequences

- **Positive:** complete audit coverage from the first commit, no historical gaps; directly satisfies the SOC2/NIST manual-review note in CLAUDE.md with an actual mechanism instead of a promise to review manually; a genuine Enterprise upsell (longer retention, export) falls out of the entitlement system for free.
- **Negative:** every context's write path has one more required call; a missed `record()` call at a new mutation site is a silent compliance gap rather than a loud failure.
- **Risks:** developers forgetting to wire `record()` into a new command. Mitigation: the `withAudit()` transactional wrapper in `/shared/db/` (owned by Distribution) is the standard way to perform any mutation — it takes the audit event as a required argument, not an afterthought, making the omission a compile error rather than an easy-to-miss step.
