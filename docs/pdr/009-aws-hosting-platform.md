# PDR-009: AWS as the Managed SaaS Hosting Platform

**Status:** Accepted
**Date:** 2026-07-20

## Context

The managed SaaS/Enterprise tier needs a concrete hosting platform, left open in the initial architecture pass. This decision also resolves two things left deliberately unresolved elsewhere: [PDR-008](008-mcp-session-state-in-memory.md)'s deferred choice between sticky sessions and Redis for MCP session state once the app scales beyond one instance, and the "buy managed Postgres" line item in `context/architecture.md`'s Build vs Buy table.

## Options Considered

### AWS
ECS/Fargate (or App Runner) for the Next.js app, RDS for Postgres, ALB in front.
Pros: mature, well-understood, wide talent pool for a future hire, RDS gives point-in-time recovery and managed backups out of the box, ALB supports sticky sessions natively for PDR-008.
Cons: more manual infra assembly than a PaaS (Vercel/Railway/Fly) — more for a solo maintainer to configure and own.

### PaaS (Vercel, Railway, Fly.io)
Pros: far less infra to configure, faster to stand up, good fit for a solo maintainer.
Cons: not chosen — explicitly ruled out in favor of AWS.

## Decision

AWS. Concretely: RDS for Postgres (managed backups, point-in-time recovery — satisfies the "buy managed Postgres" Build vs Buy line), the Next.js app on ECS/Fargate behind an Application Load Balancer.

## Consequences

- **Positive:** RDS resolves the backup/recovery open question for the SaaS tier with a standard, well-tested managed offering. ALB's native sticky-session support (`AWSALB` cookie) resolves PDR-008 cheaply — no Redis needed to horizontally scale the app tier; a session simply pins to the instance that first handled it, and losing that pin only costs one extra API-key validation round trip (already established as a safe degraded mode in PDR-008).
- **Negative:** more infrastructure-as-code and AWS-specific operational knowledge required than a PaaS would demand of a solo maintainer — ECS task definitions, ALB target groups, RDS parameter groups, VPC networking all need to be stood up and maintained.
- **Risks:** AWS's operational surface is large enough that misconfiguration (e.g. a public RDS instance, an overly permissive security group) is a real risk for a solo operator without dedicated infra experience. Mitigation: use infrastructure-as-code (Terraform or CDK) from the start rather than manual console setup, so the AWS setup is reviewable, reproducible, and diffable like any other change — not a one-off manual configuration nobody can audit later.

## Follow-up

- [PDR-008](008-mcp-session-state-in-memory.md) is updated to reflect ALB sticky sessions as the chosen mitigation, not Redis.
- `context/architecture.md`'s Build vs Buy and Operational Notes sections are updated to name RDS and ECS/Fargate explicitly.
