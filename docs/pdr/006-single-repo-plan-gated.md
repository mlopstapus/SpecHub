# PDR-006: Single Repo, Plan-Gated Features (Not Open-Core Split)

**Status:** Accepted
**Date:** 2026-07-20

## Context

SpecHub is open source with a paid managed tier layered on top. There are two common ways to structure this: an "open core" split (paid code lives in a private package/repo, imported by the OSS core, so OSS installs never contain paid source) or a single repository where paid features are gated at runtime by an entitlement/plan check.

## Options Considered

### Open-core split (separate private layer)
OSS repo has zero paid code. Paid features live in a private package that imports the OSS core as a dependency.
Pros: clean license story, nothing to strip out, no risk of a self-hoster patching a flag to unlock paid features for free.
Cons: two repos/packages to keep in sync, harder for a solo maintainer to develop paid features against a moving OSS core, more release engineering overhead.

### Single repo, feature-flagged by plan
One codebase; `resolveEntitlements(orgId)` (PDR-004) gates premium code paths at runtime.

## Decision

Single repo, plan-gated. Chosen explicitly over the open-core split recommendation for simplicity as a solo maintainer, accepting the tradeoff below.

## Consequences

- **Positive:** one codebase, one PR flow, one CI pipeline, no cross-repo version coordination — meaningfully less overhead for a solo maintainer building both the OSS core and the paid features simultaneously.
- **Negative:** all paid-feature source ships to every self-hosted install, gated only by an entitlement check rather than being physically absent.
- **Risks:** a self-hoster patches their local build to force `resolveEntitlements()` to return paid flags, running paid features for free. This is an accepted risk, not mitigated at the code level — self-hosted installs already run entirely on infrastructure and trust the operator controls, and this is the same tradeoff most single-repo open-source-plus-paid-tier projects accept. If this becomes a real problem (e.g. license-key-gated on-prem Enterprise deployments in the future), revisit this PDR before building that path, since it would need the open-core split this decision explicitly declined.
