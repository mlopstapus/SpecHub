# Deploying SpecHub (PCP) on OpenShift

This guide covers deploying the full SpecHub stack (frontend, backend, database) on
**Azure Red Hat OpenShift (ARO)** or any OpenShift 4.x cluster. Two methods are
documented:

| Method | Best for |
|--------|----------|
| **A — Source-to-Image (S2I) builds** | Quick iteration, no external registry needed |
| **B — Helm chart** | Reproducible, one-command deploy with all wiring automatic |

Both methods produce the same result: three pods (frontend, backend, database) with
correct env var wiring and an OpenShift Route exposing the frontend.

---

## Prerequisites

- `oc` CLI logged into your cluster (`oc whoami` succeeds)
- A project/namespace created: `oc new-project spechub`
- For **Method B**: `helm` v3+ installed locally
- Git repo cloned locally

---

## Architecture on OpenShift

```
Internet
    │
    ▼
┌─────────────────┐
│  OpenShift Route │  (TLS edge)
│  *.apps.xxx.io   │
└────────┬────────┘
         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    Frontend      │──────▶│     Backend      │──────▶│    Database      │
│  (Next.js :3000) │ HTTP  │  (FastAPI :8000) │ TCP   │ (Postgres :5432) │
│                  │       │                  │       │                  │
│ BACKEND_URL=     │       │ DATABASE_URL=    │       │ PGDATA=          │
│ http://backend   │       │ postgresql+      │       │ /var/lib/…/pgdata│
│   :8000          │       │  asyncpg://…     │       │                  │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

**Key env vars:**

| Service | Variable | Value |
|---------|----------|-------|
| Frontend | `BACKEND_URL` | `http://<backend-service>:8000` |
| Backend | `DATABASE_URL` | `postgresql+asyncpg://pcp:pcp@<db-service>:5432/pcp` |
| Backend | `AUTH_TOKEN` | Your API auth token |
| Database | `POSTGRES_USER` | `pcp` |
| Database | `POSTGRES_PASSWORD` | `pcp` |
| Database | `POSTGRES_DB` | `pcp` |

> **Important:** The backend auto-normalizes `DATABASE_URL` — if you provide
> `postgresql://...` it will be rewritten to `postgresql+asyncpg://...` at startup.

---

## Method A: Source-to-Image (S2I) Builds

This method builds images directly on OpenShift from the Git repo. No external
container registry needed.

### Step 1: Deploy the Database

```bash
# Create a new app from the database Dockerfile
oc new-app \
  --name=database \
  --strategy=docker \
  --context-dir=database \
  https://github.com/mlopstapus/SpecHub.git \
  -e POSTGRES_USER=pcp \
  -e POSTGRES_PASSWORD=pcp \
  -e POSTGRES_DB=pcp

# Wait for the build to complete
oc logs -f bc/database

# Add persistent storage
oc set volume deployment/database \
  --add --name=pgdata \
  --type=pvc \
  --claim-size=1Gi \
  --mount-path=/var/lib/postgresql/data

# Wait for pod to be ready
oc rollout status deployment/database
```

Verify:
```bash
oc rsh deployment/database pg_isready -U pcp
# Expected: accepting connections
```

### Step 2: Deploy the Backend

```bash
# Get the database service name
DB_SVC=$(oc get svc database -o jsonpath='{.metadata.name}')

oc new-app \
  --name=backend \
  --strategy=docker \
  --context-dir=backend \
  https://github.com/mlopstapus/SpecHub.git \
  -e DATABASE_URL=postgresql+asyncpg://pcp:pcp@${DB_SVC}:5432/pcp \
  -e AUTH_TOKEN=dev-token-123 \
  -e LOG_LEVEL=info

# Wait for the build
oc logs -f bc/backend

# Wait for rollout
oc rollout status deployment/backend
```

Verify:
```bash
oc rsh deployment/backend curl -s http://localhost:8000/health
# Expected: {"status":"ok"}
```

### Step 3: Deploy the Frontend

```bash
# Get the backend service name
BACKEND_SVC=$(oc get svc backend -o jsonpath='{.metadata.name}')

oc new-app \
  --name=frontend \
  --strategy=docker \
  --context-dir=frontend \
  https://github.com/mlopstapus/SpecHub.git \
  -e BACKEND_URL=http://${BACKEND_SVC}:8000

# Wait for the build
oc logs -f bc/frontend

# Wait for rollout
oc rollout status deployment/frontend
```

### Step 4: Expose the Frontend

```bash
# Create an edge-terminated TLS route
oc create route edge frontend --service=frontend --port=3000

# Get the URL
ROUTE=$(oc get route frontend -o jsonpath='{.spec.host}')
echo "SpecHub is live at: https://${ROUTE}"
```

### Step 5: Verify End-to-End

```bash
# Health check through the frontend proxy
curl -s https://${ROUTE}/health
# Expected: {"status":"ok"}

# List prompts
curl -s https://${ROUTE}/api/v1/prompts
# Expected: {"items":[],"total":0,"page":1,"page_size":20}
```

### Rebuilding After Code Changes

```bash
# Rebuild a single service (e.g. after pushing code)
oc start-build backend --follow
oc start-build frontend --follow
oc start-build database --follow

# Or rebuild all
for svc in database backend frontend; do
  oc start-build $svc --follow
done
```

### Setting / Updating Env Vars

```bash
# View current env vars
oc set env deployment/frontend --list
oc set env deployment/backend --list

# Update an env var (triggers automatic rollout)
oc set env deployment/frontend BACKEND_URL=http://backend:8000
oc set env deployment/backend DATABASE_URL=postgresql+asyncpg://pcp:pcp@database:5432/pcp
```

---

## Method B: Helm Chart

The Helm chart deploys all three services with automatic env var wiring.

The chart is published to GHCR as an OCI artifact. You can install it directly
without cloning the repo:

```bash
helm install sh oci://ghcr.io/mlopstapus/charts/pcp --version 0.1.1 \
  --set backend.image.repository=$INT_REG/$NS/backend \
  --set backend.image.tag=latest \
  --set frontend.image.repository=$INT_REG/$NS/frontend \
  --set frontend.image.tag=latest \
  --set database.image.repository=$INT_REG/$NS/database \
  --set database.image.tag=latest
```

Or use the local chart from a clone: `helm install sh ./charts/pcp ...`

### Step 1: Build Images with S2I

Use OpenShift S2I builds to create images directly on the cluster. No external
registry or `docker push` needed — the built images land in the internal registry
and are referenced by ImageStream tags.

```bash
NS=$(oc project -q)  # e.g. spechub
INT_REG=image-registry.openshift-image-registry.svc:5000

# Build all three images via S2I (Docker strategy)
for component in database backend frontend; do
  oc new-build \
    --name=$component \
    --strategy=docker \
    --context-dir=$component \
    https://github.com/mlopstapus/SpecHub.git

  # Follow the build log (blocks until done)
  oc logs -f bc/$component
done

# Verify the images landed
oc get imagestream
```

Each build creates an ImageStream tag `<name>:latest` that resolves to
`image-registry.openshift-image-registry.svc:5000/<namespace>/<name>:latest`
inside the cluster.

### Step 2: Install the Helm Chart Using S2I Images

Point the Helm chart at the internal registry images built by S2I:

```bash
helm install sh ./charts/pcp \
  --set backend.image.repository=$INT_REG/$NS/backend \
  --set backend.image.tag=latest \
  --set frontend.image.repository=$INT_REG/$NS/frontend \
  --set frontend.image.tag=latest \
  --set database.image.repository=$INT_REG/$NS/database \
  --set database.image.tag=latest
```

> **What this gives you:** S2I handles image builds (no Docker locally, no
> external registry), and the Helm chart handles all the deployment wiring
> (services, env vars, secrets, routes, migrations).

### Rebuilding After Code Changes

Trigger a new S2I build — the ImageStream tag `latest` updates automatically.
Then restart the Helm-managed deployments to pick up the new image:

```bash
# Automated: use the rollout script
./scripts/rollout.sh              # rebuild all + cycle all
./scripts/rollout.sh backend      # backend only
./scripts/rollout.sh --no-build   # skip builds, just restart pods

# Or manually:
oc start-build backend --follow
oc start-build frontend --follow
oc rollout restart deployment/sh-pcp-backend
oc rollout restart deployment/sh-pcp-frontend
```

### Alternative: Pre-built Images

If you prefer to push images from CI or locally instead of S2I:

**GitHub Container Registry (ghcr.io):**
```bash
# Push from CI or locally
for component in backend frontend database; do
  docker build -t ghcr.io/mlopstapus/spechub-$component:0.1.1 ./$component/
  docker push ghcr.io/mlopstapus/spechub-$component:0.1.1
done

# Create a pull secret if the registry is private
oc create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-user> \
  --docker-password=<github-pat>
oc secrets link default ghcr-pull-secret --for=pull

helm install sh ./charts/pcp \
  --set backend.image.repository=ghcr.io/mlopstapus/spechub-backend \
  --set backend.image.tag=0.1.1 \
  --set frontend.image.repository=ghcr.io/mlopstapus/spechub-frontend \
  --set frontend.image.tag=0.1.1 \
  --set database.image.repository=ghcr.io/mlopstapus/spechub-database \
  --set database.image.tag=0.1.1 \
  --set imagePullSecrets[0].name=ghcr-pull-secret
```

**Overriding defaults:**
```bash
helm install sh ./charts/pcp \
  --set postgresql.password=<strong-password> \
  --set backend.authToken=<your-auth-token> \
  --set database.storage.size=5Gi \
  --set frontend.route.host=spechub.example.com
```

### Step 3: Verify

```bash
# Check all pods
oc get pods -l app.kubernetes.io/instance=sh

# Check the migration job
oc get jobs -l app.kubernetes.io/instance=sh

# Get the frontend route URL
ROUTE=$(oc get route sh-pcp-frontend -o jsonpath='{.spec.host}')
echo "SpecHub is live at: https://${ROUTE}"

# Test
curl -s https://${ROUTE}/health
curl -s https://${ROUTE}/api/v1/prompts
```

### Upgrading

When upgrading the Helm chart version, pass the S2I image overrides again so the
deployments continue to pull from the internal registry (not the default GHCR images
in `values.yaml`):

```bash
NS=$(oc project -q)
INT_REG=image-registry.openshift-image-registry.svc:5000

helm upgrade sh oci://ghcr.io/mlopstapus/charts/pcp --version <new-version> \
  --set backend.image.repository=$INT_REG/$NS/backend \
  --set backend.image.tag=latest \
  --set frontend.image.repository=$INT_REG/$NS/frontend \
  --set frontend.image.tag=latest \
  --set database.image.repository=$INT_REG/$NS/database \
  --set database.image.tag=latest
```

> **Important:** Do not use `--reuse-values` without the image overrides — the
> stored values may point at stale GHCR images instead of the S2I-built images
> in the internal registry.

### Uninstalling

```bash
helm uninstall sh

# PVCs are not deleted automatically (safety)
oc delete pvc -l app.kubernetes.io/instance=sh
```

---

## What the Helm Chart Creates

| Resource | Name | Purpose |
|----------|------|---------|
| Secret | `sh-pcp` | DATABASE_URL, AUTH_TOKEN, postgresql-password |
| Deployment | `sh-pcp-backend` | FastAPI backend, port 8000 |
| Service | `sh-pcp-backend` | ClusterIP for backend |
| Deployment | `sh-pcp-frontend` | Next.js frontend, port 3000 |
| Service | `sh-pcp-frontend` | ClusterIP for frontend |
| Route | `sh-pcp-frontend` | TLS edge route (OpenShift) |
| StatefulSet | `sh-pcp-database` | PostgreSQL with PVC |
| Service | `sh-pcp-database` | ClusterIP for database |
| Job | `sh-pcp-migrate` | Alembic migration (Helm hook) |

---

## Using an External Database

To use an existing PostgreSQL instance (e.g. Azure Database for PostgreSQL)
instead of the built-in StatefulSet:

```bash
helm install sh ./charts/pcp \
  --set database.enabled=false \
  --set postgresql.host=my-pg-server.postgres.database.azure.com \
  --set postgresql.port=5432 \
  --set postgresql.database=pcp \
  --set postgresql.username=pcp \
  --set postgresql.password=<password>
```

---

## Configuring MCP Clients

Once deployed, get the route URL and configure your IDE:

```bash
ROUTE=$(oc get route sh-pcp-frontend -o jsonpath='{.spec.host}')
echo "MCP endpoint: https://${ROUTE}/mcp"
```

Add to your MCP config (e.g. `~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "spechub": {
      "serverUrl": "https://<route-host>/mcp"
    }
  }
}
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Frontend returns 500 on `/api/*` | `BACKEND_URL` not set or wrong | `oc set env deployment/frontend BACKEND_URL=http://backend:8000` (use actual svc name) |
| Backend `ModuleNotFoundError: psycopg2` | `DATABASE_URL` uses `postgresql://` instead of `postgresql+asyncpg://` | Fixed in code — backend auto-rewrites. If using old image, update `DATABASE_URL` to use `postgresql+asyncpg://` |
| Database `initdb: Operation not permitted` | PGDATA permissions on OpenShift | Use the custom database image (sets `PGDATA` to subdirectory) |
| `ENOTFOUND` on service name | Frontend can't resolve backend DNS | Verify service exists: `oc get svc`. Use the exact service name in `BACKEND_URL` |
| `ImagePullBackOff` | Image not accessible from cluster | Check `oc describe pod <name>` for the exact error. Verify registry credentials and image path |
| Backend `ConnectionRefusedError` on port 5432 | Database not ready yet | Wait for database pod: `oc rollout status deployment/database`. Backend will retry on next request |
| Migration job fails | Database not ready when job runs | Delete and re-run: `oc delete job sh-pcp-migrate && helm upgrade sh ./charts/pcp ...` |
| `sharp` missing error in frontend | Old frontend image | Rebuild: `oc start-build frontend --follow` |
| Route not resolving | DNS not configured | Check: `oc get route`. ARO routes use `*.apps.<cluster>.aroapp.io` — no extra DNS needed |

### Useful Debug Commands

```bash
# Pod status
oc get pods

# Logs
oc logs deployment/backend
oc logs deployment/frontend
oc logs deployment/database

# Shell into a pod
oc rsh deployment/backend

# Check env vars
oc set env deployment/backend --list
oc set env deployment/frontend --list

# Check services (these are the DNS names pods use)
oc get svc

# Check routes
oc get routes

# Restart a deployment
oc rollout restart deployment/backend
```
