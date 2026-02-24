# OpenShift-Ready Container Images

## Overview

Update both container images (backend Python API and frontend Next.js app) so they run correctly on OpenShift, which enforces running as an **arbitrary non-root UID** within GID 0 (`root` group).

---

## Current Issues

### Backend `Dockerfile`
- No non-root user created — container runs as root (PID 1 = root)
- `/app` owned by root with default permissions — arbitrary UID can't write

### Frontend `frontend/Dockerfile`
- Hardcoded UID/GID 1001:1001 (`nextjs:nodejs`) — OpenShift assigns arbitrary UIDs, not 1001
- `--chown=nextjs:nodejs` uses GID 1001 — must be GID 0 for OpenShift
- `.next/` cache directory not group-writable

---

## Changes

### 1. Backend `Dockerfile`
- Create a non-root user (UID 1001, GID 0)
- `chown` `/app` to `1001:0` with group-rwx on dirs that need writes
- Add `USER 1001` directive
- Ensure `scripts/start.sh` and app files are group-readable/executable

### 2. Frontend `frontend/Dockerfile`
- Replace `addgroup nodejs` + `adduser nextjs` with a single user in GID 0
- Change all `--chown` to `1001:0`
- Ensure `.next/` cache is group-writable
- Keep `USER 1001` (compatible with arbitrary UID since GID 0 is what matters)

---

## Acceptance Criteria

1. Both images build successfully
2. Both containers run as non-root (UID 1001 by default)
3. Both containers work under an arbitrary UID with GID 0 (OpenShift behavior)
4. No file permission errors at runtime
5. Existing functionality unchanged
