# PDR-002: Drizzle as the ORM

**Status:** Accepted
**Date:** 2026-07-20

## Context

Need a TypeScript ORM/query builder for Postgres to replace SQLAlchemy + Alembic. The domain has real relational structure (recursive team hierarchy, several foreign-keyed aggregates, JSONB columns for flexible fields like scopes/steps/entitlement overrides) and needs a migration story as disciplined as Alembic's.

## Options Considered

### Prisma
Schema-first, codegen-based client, mature migration tooling (`prisma migrate`).
Pros: excellent DX, huge ecosystem, generated types.
Cons: separate schema DSL to maintain alongside TS types, codegen step in the build, heavier runtime, less direct control over generated SQL (matters for the recursive team-chain query and priority-ordered policy resolution, which want to stay close to raw SQL for correctness and performance).

### Drizzle
TypeScript-first schema definitions (no separate DSL/codegen), thin query builder close to SQL, `drizzle-kit` for migrations.
Pros: schema is TypeScript (one less thing to keep in sync), lighter runtime, easy to drop to raw SQL for the hairier recursive/priority queries without leaving the tool, good multi-schema (Postgres schema-per-BC) support.
Cons: smaller ecosystem than Prisma, less tooling polish, migration DX is more manual.

### Kysely (query builder only, no schema/migration story)
Pros: maximally close to SQL, fully type-safe.
Cons: no migration tooling built in — would need a separate tool anyway, more assembly required for a solo maintainer.

## Decision

Use Drizzle. The schema-in-TypeScript model fits the "one language, full type safety" goal better than a separate Prisma DSL, and the closeness to raw SQL matters for the Governance resolver and Prompt Registry's recursive inclusion logic, which are exactly the queries worth hand-tuning rather than abstracting away.

## Consequences

- **Positive:** schema and types live in one place, no codegen build step, straightforward per-BC Postgres schema support (see PDR-003 data architecture notes), easy escape hatch to raw SQL where it matters.
- **Negative:** smaller community/fewer Stack Overflow answers than Prisma; migration tooling (`drizzle-kit`) is less mature than `prisma migrate` or Alembic.
- **Risks:** migration tooling immaturity biting during the SaaS multi-tenant buildout. Mitigation: write and review every migration by hand rather than trusting full auto-generation, same discipline the team already applies to Alembic migrations today.
