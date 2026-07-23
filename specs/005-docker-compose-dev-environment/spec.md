# Feature Specification: Docker Compose Dev Environment

**Feature Branch**: `005-docker-compose-dev-environment`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "backlog/001-typescript-refactor-foundation/005-docker-compose-dev-environment.md"

## Clarifications

### Session 2026-07-22

- Q: Should the database service still auto-run the legacy `001_schema.sql` init script on first boot, or should schema creation be handled entirely by Drizzle migrations against an otherwise-empty database? → A: Drop the legacy schema init script. The database container only carries forward the Dockerfile's OpenShift-hardening behavior; the migration tooling (FR-007) is solely responsible for schema.
- Q: Should `.env.example` document only variables the app actually reads today, or forward-declare the JWT secret and self-host entitlement-bypass variables now even though they're inert until a later epic implements auth/billing? → A: Document only currently-consumed variables now (the database connection strings). The JWT secret and entitlement-bypass variable are added by whichever future epic implements auth/billing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-command local environment (Priority: P1)

As a developer working on SkillCanon, I want `docker compose up -d` to boot the new unified app connected to Postgres, so I can develop against and test the app locally without hand-wiring separate backend/frontend services together.

**Why this priority**: This is the core value of the feature — an always-runnable local environment that tracks the unified app rather than the legacy split layout. Without it, `docker compose up -d` (the command CLAUDE.md documents) silently drifts out of sync with the actual codebase as the refactor progresses.

**Independent Test**: From a clean checkout, run `docker compose up -d` and confirm the app service and database service both start, the app is reachable over HTTP on its documented port, and the app successfully connects to Postgres.

**Acceptance Scenarios**:

1. **Given** a clean checkout of the repository, **When** a developer runs `docker compose up -d`, **Then** the app service and the database service both start successfully.
2. **Given** the environment is running, **When** the app attempts to connect to Postgres, **Then** the connection succeeds without manual intervention.
3. **Given** the environment is running, **When** a developer requests the app's documented local URL, **Then** the app responds successfully.
4. **Given** the unified app's own Dockerfile now builds the app service, **When** the compose configuration is inspected, **Then** it no longer references the old separate backend or frontend Dockerfiles, and those Dockerfiles have been removed from the repository.

---

### User Story 2 - Documented local environment configuration (Priority: P1)

As a developer setting up local development, I want every environment variable the local stack actually needs today — such as the database connection string(s) and any Postgres credentials the compose stack requires — documented in `.env.example`, so I can configure my environment correctly on the first try instead of guessing or digging through code.

**Why this priority**: An environment that only works with tribal knowledge isn't really "always runnable." This is equally foundational to Story 1 — the compose stack is only as usable as its configuration is discoverable.

**Independent Test**: Copy `.env.example` to `.env`, fill in the placeholder values, boot the stack, and confirm nothing fails due to a missing or undocumented configuration value.

**Acceptance Scenarios**:

1. **Given** a fresh copy of `.env.example`, **When** a developer fills in every listed value and boots the stack, **Then** no required configuration value is missing.
2. **Given** the documented variables are filled in, **When** the compose stack boots, **Then** no additional, undocumented variable is required for a successful boot.

---

### User Story 3 - Migrations run against the local stack (Priority: P2)

As a developer, I want to run database migrations against the Postgres instance provisioned by `docker compose up -d`, so my local schema matches the current code without needing a separate, differently-configured database.

**Why this priority**: This extends the value of Story 1 (a working local stack) to the common next step every developer takes after boot — getting the schema current. It's P2 because the stack from Story 1 is usable for basic verification even before this is wired up, but no real development can proceed without it.

**Independent Test**: Boot the stack with `docker compose up -d`, then run the project's migration command against it and confirm the schema is applied with no additional setup.

**Acceptance Scenarios**:

1. **Given** the stack is running via `docker compose up -d`, **When** a developer runs the migration command, **Then** it connects to the compose-provisioned Postgres instance and applies successfully.

---

### Edge Cases

- What happens when the app service starts before Postgres has finished initializing? The app must not crash-loop or require a manual restart once Postgres becomes ready.
- What happens when a developer boots the stack with `.env` still at its placeholder values? Startup should fail with a clear, actionable message rather than silently running with broken configuration (per the project's existing "no functional default for security-critical settings" rule).
- What happens to a developer's existing containers/volumes from the old three-service (`backend`/`frontend`/`database`) layout? The old service names disappear from the compose file; a developer resuming an old checkout should not end up with orphaned containers silently still running alongside the new ones.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Docker Compose configuration MUST define exactly two services — an app service and a database service — replacing the current three-service (`backend`, `frontend`, `database`) layout.
- **FR-002**: The app service MUST build and run from the unified Next.js application's own Dockerfile, not from the legacy backend or frontend Dockerfiles.
- **FR-003**: The database service MUST carry forward the existing container-hardening behavior (OpenShift-compatible non-root UID/GID setup) from the current `database/` setup, but MUST NOT bundle the legacy schema init script — schema creation is owned entirely by the database migration tooling (see FR-007), not by a pre-baked SQL file tied to the legacy app's data model.
- **FR-004**: `docker compose up -d` MUST result in the app being reachable over HTTP on its documented local port.
- **FR-005**: `docker compose up -d` MUST result in the app successfully connecting to the Postgres service without any manual step beyond providing a filled-in `.env`.
- **FR-006**: Every environment variable the app and database services actually consume today — the database connection string(s) and any Postgres credentials the compose stack requires — MUST be documented in an updated `.env.example`. Variables for not-yet-implemented features (a JWT secret, a self-host entitlement-bypass setting) are explicitly out of scope for this feature; they are added by whichever future epic implements auth/billing.
- **FR-007**: Database migrations MUST be runnable against the Postgres instance provisioned by the compose stack.
- **FR-008**: The legacy `backend/Dockerfile` and `frontend/Dockerfile` MUST be removed once the unified app's Dockerfile replaces both.
- **FR-009**: CLAUDE.md's existing "Rebuild" command entry (`docker compose up -d`) MUST remain accurate with no further edits required as a result of this change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer on a clean checkout goes from `docker compose up -d` to a reachable, database-connected app in under 2 minutes, with no manual troubleshooting steps.
- **SC-002**: Every environment variable required for local development is documented in `.env.example` — zero required variables are missing or undocumented.
- **SC-003**: No manual configuration steps are needed beyond filling in `.env` and running `docker compose up -d` (plus the separate, expected migration step) to reach a fully working local environment.
- **SC-004**: The old three-service compose layout is fully retired — no compose service, Dockerfile reference, or documentation still points at the legacy split backend/frontend containers after this change lands.

## Assumptions

- This feature builds on the unified app scaffold and its Dockerfile (`001-nextjs-app-scaffolding`) and the shared database kernel and migration tooling (`002-drizzle-shared-db-kernel`), both already completed, per this backlog item's stated dependencies.
- Migrations are run as a distinct, developer-initiated step against the compose-provisioned database rather than automatically on container start — consistent with how migrations are run today and avoiding surprise schema changes on every `up`.
- The self-host billing-bypass behavior (the existing "Free-tier entitlements hardcoded locally, billing disabled" pattern) is out of scope for this feature's `.env.example` work, since the billing-entitlements bounded context has no implemented logic yet — it will be documented by whichever future epic wires that context up.
- The Helm chart (Kubernetes deployment) is explicitly out of scope for this feature and is deferred to a later distribution-focused backlog item, per this backlog item's own technical notes.
- The app's local port and the database's local port keep their currently exposed values so existing developer tooling (e.g., a local SQL client connecting to Postgres) keeps working unchanged.
- `docker-compose.yaml` is also the self-hosted deployment mechanism (CLAUDE.md labels it "Rebuild (self-hosted stack)"), not local-dev-only. It previously hardcoded a known Postgres credential; this feature made that credential overridable (`${POSTGRES_PASSWORD:-skillcanon}`-style interpolation, see research.md Decision 4's note) so a self-host operator can set a real one without editing the compose file, while keeping the zero-config default for local dev. A fully enforced posture (failing to boot on a still-default credential) remains a distinct, future security-hardening item.
