# Move Backend Source Into `backend/`

## Overview

Consolidate all backend source code into `backend/` alongside its Dockerfile, mirroring the `frontend/` layout. The repo root becomes a thin shell holding only repo-wide files.

---

## Current Layout

```
PCP/
├── backend/Dockerfile      ← already here
├── src/pcp_server/         ← needs to move
├── tests/                  ← needs to move
├── alembic/                ← needs to move
├── alembic.ini             ← needs to move
├── pyproject.toml          ← needs to move
├── scripts/                ← needs to move
├── frontend/               ← stays
├── charts/                 ← stays
├── docker-compose.yaml     ← stays (update paths)
├── docs/                   ← stays (update refs)
└── README.md               ← stays (update refs)
```

## Target Layout

```
PCP/
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/
│   ├── src/pcp_server/
│   ├── tests/
│   └── scripts/
├── frontend/
│   ├── Dockerfile
│   └── ...
├── charts/
├── docs/
├── docker-compose.yaml
└── README.md
```

---

## Changes

### 1. Move files
- `src/` → `backend/src/`
- `tests/` → `backend/tests/`
- `alembic/` → `backend/alembic/`
- `alembic.ini` → `backend/alembic.ini`
- `pyproject.toml` → `backend/pyproject.toml`
- `scripts/` → `backend/scripts/`
- `.env.example` → `backend/.env.example`

### 2. Update `backend/Dockerfile`
- Build context changes from repo root to `backend/`
- Remove path prefixes from COPY commands (they're now relative to `backend/`)

### 3. Update `docker-compose.yaml`
- `pcp` service: `context: ./backend`, remove `dockerfile:` (Dockerfile is at default location)

### 4. Update `backend/alembic/env.py`
- `sys.path.insert` line — parent path changes

### 5. Update Helm chart `migration-job.yaml`
- The migration job command should still work since the image is self-contained

### 6. Update docs
- `docs/architecture.md` — project structure diagram
- `docs/deploy-openshift-crc.md` — docker build command
- `README.md` — quickstart paths, test command

### 7. Update `.gitignore` / `.dockerignore`
- Adjust paths if needed

---

## Acceptance Criteria

1. `docker build` from `backend/` works
2. `docker-compose up` works
3. All 159 tests pass (run from `backend/`)
4. `alembic upgrade head` works from `backend/`
5. Helm chart still deploys correctly (image is self-contained)
6. Docs/README reflect new structure
