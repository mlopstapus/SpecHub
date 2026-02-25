# Custom PostgreSQL Image with Pre-initialized Schema

## Overview

Create a `database/` directory with a custom PostgreSQL Dockerfile that ships the PCP schema pre-initialized via `docker-entrypoint-initdb.d`. The image must be OpenShift-ready (arbitrary UID, GID 0). This replaces the stock `postgres:16-alpine` in docker-compose.

---

## Target Layout

```
PCP/
├── database/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── init/
│       └── 001_schema.sql       # Full DDL from alembic migrations
├── backend/
├── frontend/
└── docker-compose.yaml          # updated to build: ./database
```

---

## Changes

### 1. Generate `database/init/001_schema.sql`
- Convert all 3 alembic migrations (001, 002, 003) into a single idempotent SQL init script
- Include: all CREATE TABLE, indexes, constraints, enums
- Include migration 002 (nullable user_template) and 003 (sharing tables)

### 2. Create `database/Dockerfile`
- Base: `postgres:16-alpine`
- COPY `init/*.sql` into `/docker-entrypoint-initdb.d/`
- OpenShift-ready: `chmod -R g=u`, proper ownership, `USER` directive
  - Note: postgres entrypoint handles user switching; need to ensure initdb works with arbitrary UID

### 3. Create `database/.dockerignore`

### 4. Update `docker-compose.yaml`
- Replace `image: postgres:16-alpine` with `build: ./database`
- Keep existing env vars (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB)

### 5. Update docs
- README: mention custom DB image
- architecture.md: add database/ to project structure

---

## OpenShift Considerations

- The official `postgres` image runs `initdb` as the `postgres` user
- On OpenShift, the container runs as an arbitrary UID in GID 0
- The Red Hat `postgresql` images handle this natively
- Alternative: use `registry.redhat.io/rhel9/postgresql-16` which is OpenShift-native
- Simpler: stick with `postgres:16-alpine` + fix permissions for `/var/lib/postgresql/data`

---

## Acceptance Criteria

1. `docker build database/` succeeds
2. `docker-compose up` creates DB with schema pre-loaded
3. Backend `alembic upgrade head` is idempotent (no errors on already-initialized DB)
4. All 159 backend tests still pass
5. Image works on OpenShift (arbitrary UID with GID 0)
