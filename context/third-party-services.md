# Third-Party Service Selection

**Status:** Decided
**Decided:** 2026-07-21
**Backlog item:** `backlog/000-foundations/008-third-party-services.md`

## Transactional email

**Amazon SES for the managed SaaS**, with **generic SMTP config (env vars) as the self-hosted fallback** — not a hard dependency on any single vendor.

- SaaS: infra is already on AWS (PDR-009), so SES means one fewer external vendor relationship and IAM-based auth instead of another API key to provision/rotate. Deliverability at expected early-stage volume is adequate for SES; revisit (Resend/Postmark) only if deliverability becomes a measured problem.
- Self-host: operators configure `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` (or leave unset, in which case invitation/notification emails are skipped with a clear log line, not a crash) — self-hosters should never be required to have an AWS account just to run SpecHub.
- Both paths go through one `shared` email-sending interface (a thin abstraction: `sendEmail(to, template, data)`) so the SES vs. SMTP choice is a config-time implementation swap, not two different code paths through the app.

## Sentry setup

- **Separate Sentry projects per environment** (`spechub-staging`, `spechub-production`) rather than one project with environment tags — keeps noisy staging errors from diluting production alerting, and keeps alert routing rules simple (no environment filter needed on every alert rule).
- **Source maps uploaded in the CI pipeline** at build time (the same GitHub Actions build step that produces the Docker image — see `context/deployment.md`), using a Sentry auth token stored as a repo/environment secret.
- **Self-hosted installs: opt-in only**, via a `SENTRY_DSN` env var operators set themselves — never bundled or forced. If unset, error tracking is a no-op (errors still go to structured logs per `context/api-conventions.md`'s logging schema, just not to Sentry). This matches the same "self-host isn't forced into a vendor relationship" principle as the email decision above.

## Deliverable status

Email provider (with self-host SMTP fallback) and Sentry project/environment setup are settled. This unblocks the invitation feature in `002-identity-access` and the billing notification features in `008-billing-entitlements`.
