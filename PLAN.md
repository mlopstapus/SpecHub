# Helm Chart Distribution via GHCR

## Overview

Publish the SpecHub Helm chart as an OCI artifact to GitHub Container Registry
(ghcr.io) so users can install directly with `helm install` — no git clone needed.

---

## Changes

### 1. Create GitHub Actions workflow: `.github/workflows/helm-publish.yml`
- **Trigger:** push to `main` when `charts/pcp/**` changes, plus manual dispatch
- **Steps:**
  1. Checkout repo
  2. Install Helm 3
  3. `helm lint charts/pcp/`
  4. `helm package charts/pcp/`
  5. `helm registry login ghcr.io` using `GITHUB_TOKEN`
  6. `helm push pcp-<version>.tgz oci://ghcr.io/mlopstapus/charts`
- **Permissions:** `packages: write`, `contents: read`

### 2. Update `charts/pcp/Chart.yaml`
- Fix `home` and `sources` URLs to point to `mlopstapus/SpecHub`

### 3. Update `docs/deploy-openshift.md`
- Add "Install from GHCR" section showing the OCI install command
- This becomes the primary install path (no git clone needed)

### 4. Update `README.md`
- Add quick-start Helm install snippet

---

## Acceptance Criteria

1. `helm lint charts/pcp/` passes
2. GitHub Actions workflow is valid YAML
3. Deploy doc shows OCI install command
4. After merge to main, chart is published to `oci://ghcr.io/mlopstapus/charts/pcp`
