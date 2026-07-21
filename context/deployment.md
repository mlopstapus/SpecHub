# Deployment, Environments & AWS Topology

**Status:** Decided (provisional — see Revisit triggers)
**Decided:** 2026-07-21
**Backlog item:** `backlog/000-foundations/005-deployment-environments-and-aws-topology.md`

## AWS account structure

**Single AWS account, environment-tagged resources** (`Environment=staging` / `Environment=production` tags, separate resource names/prefixes per environment within the account). Chosen as the pragmatic starting point for a solo maintainer pre-revenue — separate accounts per environment add real setup/ops overhead (cross-account IAM, separate billing, account-vending) that isn't justified until there's an actual compliance driver (e.g. an Enterprise customer's security review) demanding the isolation.

**Revisit trigger:** move to separate accounts (e.g. via AWS Organizations) the first time an Enterprise deal's security questionnaire requires it, or before SOC2 Type II if the auditor flags shared-account blast radius as a finding.

## VPC layout

One VPC per environment (both in the same account), public/private subnet split across two AZs (for later Multi-AZ readiness even though RDS itself launches single-AZ — see below):
- **Public subnets:** ALB only.
- **Private subnets:** ECS/Fargate tasks and RDS. No task or database has a public IP.
- **NAT gateway:** one per environment (not per AZ) at launch — halves NAT cost versus one-per-AZ, accepting the single-NAT availability tradeoff since the app tier itself isn't yet HA yet either (see PDR-008's pre-scaling checklist).

## RDS configuration

**Single-AZ at launch.** No availability target has been set for the SaaS tier yet (flagged as an open question in `architecture.md`), and single-AZ is the launch-appropriate, lower-cost choice while there's no committed uptime SLA. Automated backups and point-in-time recovery (RDS-managed) are enabled regardless of AZ configuration.

**Revisit trigger:** move to Multi-AZ the moment there's a stated availability target (an SLA in an Enterprise contract, or a self-imposed uptime commitment) — this is a config change, not a re-architecture, so it's fine to defer rather than pay for it before it's needed.

## Infrastructure as code

**Terraform, run through Terraform Cloud (TFC)** — not AWS CDK. TFC owns remote state, run history, and plan/apply approval as a hosted workflow, which is the deciding factor over CDK's same-language (TypeScript) appeal: a solo maintainer benefits more from not self-managing state storage/locking (an S3+DynamoDB backend) and having a hosted apply gate than from infra code sharing a language with the app. HCL being a second language alongside TypeScript is the accepted tradeoff.

- **Workspaces:** one TFC workspace per environment (`spechub-staging`, `spechub-production`), matching the single-account/environment-tagged topology above.
- **State:** managed entirely by TFC (remote backend) — no local `terraform.tfstate`, no manual state backend to provision.
- **Apply gate:** `main` merges trigger a TFC plan automatically; apply requires manual confirmation in TFC for `production` (auto-apply is acceptable for `staging`) — this is the IaC-level equivalent of the manual staging→production promotion gate in the CI/CD pipeline below.
- **Secrets:** AWS credentials for TFC's runs are configured as TFC workspace variables (dynamic provider credentials via OIDC where possible, avoiding long-lived IAM user keys).

## CI/CD pipeline

GitHub Actions (carried forward from the current `.github/workflows/`):
1. On PR: install, lint, `tsc --noEmit`, run the epic-000-003 test suite (unit + integration via Testcontainers — see `context/testing-strategy.md`).
2. On merge to `main`: build the Docker image, push to ECR, run `drizzle-kit migrate` against staging, deploy to staging ECS service.
3. **Staging → production promotion is manual** — a GitHub Actions workflow dispatch (not automatic on every merge), so a human decides when production actually receives a new version. Given solo-maintainer scale, this is simpler and safer than building out a canary/progressive-rollout pipeline before there's traffic that would benefit from one.

## Release process

- **Rollback:** redeploy the previous ECS task definition revision (ECS retains prior revisions by default) — no blue/green infrastructure at launch, just "point the service back at the last-known-good task def."
- **Database migrations:** forward-only at launch (no auto-generated down-migrations relied upon) — a bad migration is fixed with a new forward migration, not a rollback, since Drizzle's down-migration story is secondary to its up-migration workflow. Acceptable given pre-launch there's no production data to protect (per `architecture.md`'s Migration path note).

## Self-hosted deployment story

Docker Compose (local) and the Helm chart (K8s) remain the two self-host paths, both consuming the **same container image** the SaaS runs — this is what the single-repo, plan-gated decision (PDR-006) requires: one build artifact, `STRIPE_ENABLED=false` and Free-tier entitlements hardcoded for self-host, the identical code path otherwise.

## Deliverable status

Account/VPC topology, RDS configuration with a stated (deferred) availability posture, IaC tool choice, CI/CD pipeline, and release/rollback process are settled — provisionally, with explicit revisit triggers rather than treated as permanent. This unblocks the AWS-facing portions of the `distribution` epic and `008-billing-entitlements` (the Stripe webhook endpoint needs a real deployed URL to register against).
