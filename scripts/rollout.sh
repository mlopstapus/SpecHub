#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# rollout.sh — Rebuild S2I images and cycle OpenShift deployments
#
# Usage:
#   ./scripts/rollout.sh                  # rebuild all + cycle all
#   ./scripts/rollout.sh backend          # rebuild & cycle backend only
#   ./scripts/rollout.sh frontend backend # rebuild & cycle selected services
#   ./scripts/rollout.sh --no-build       # skip S2I builds, just cycle pods
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SERVICES=(backend frontend database)
HELM_RELEASE="${HELM_RELEASE:-sh}"
GIT_REPO="${GIT_REPO:-https://github.com/mlopstapus/SpecHub.git}"
GIT_REF="${GIT_REF:-main}"
SKIP_BUILD=false

# ── Parse args ───────────────────────────────────────────────────────────────
targets=()
for arg in "$@"; do
  case "$arg" in
    --no-build) SKIP_BUILD=true ;;
    backend|frontend|database) targets+=("$arg") ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: $0 [--no-build] [backend] [frontend] [database]"
      exit 1
      ;;
  esac
done

# Default to all services if none specified
if [[ ${#targets[@]} -eq 0 ]]; then
  targets=("${SERVICES[@]}")
fi

echo "━━━ SpecHub OpenShift Rollout ━━━"
echo "Targets:    ${targets[*]}"
echo "Skip build: ${SKIP_BUILD}"
echo "Helm release: ${HELM_RELEASE}"
echo ""

# ── Verify oc is logged in ──────────────────────────────────────────────────
if ! oc whoami &>/dev/null; then
  echo "❌ Not logged in to OpenShift. Run 'oc login' first."
  exit 1
fi
NAMESPACE=$(oc project -q)
echo "Namespace: ${NAMESPACE}"
echo ""

# ── Patch BuildConfigs if repo URL or ref is stale ────────────────────────
if [[ "$SKIP_BUILD" == false ]]; then
  for svc in "${targets[@]}"; do
    if oc get bc/"$svc" &>/dev/null; then
      CURRENT_URI=$(oc get bc/"$svc" -o jsonpath='{.spec.source.git.uri}')
      CURRENT_REF=$(oc get bc/"$svc" -o jsonpath='{.spec.source.git.ref}')
      if [[ "$CURRENT_URI" != "$GIT_REPO" ]] || [[ "$CURRENT_REF" != "$GIT_REF" ]]; then
        echo "🔧 Patching BuildConfig ${svc}: ${CURRENT_URI}#${CURRENT_REF} → ${GIT_REPO}#${GIT_REF}"
        oc patch bc/"$svc" -p "{\"spec\":{\"source\":{\"git\":{\"uri\":\"${GIT_REPO}\",\"ref\":\"${GIT_REF}\"}}}}"
      fi
    fi
  done
fi

# ── Rebuild S2I images ──────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == false ]]; then
  for svc in "${targets[@]}"; do
    if oc get bc/"$svc" &>/dev/null; then
      echo "🔨 Starting S2I build: ${svc}..."
      oc start-build "$svc" --follow --wait
      echo "✅ Build complete: ${svc}"
      echo ""
    else
      echo "⚠️  No BuildConfig found for '${svc}' — skipping build"
    fi
  done
fi

# ── Helm upgrade to pick up new S2I images ────────────────────────────────
INT_REG="image-registry.openshift-image-registry.svc:5000"
CHART_DIR="${CHART_DIR:-$(cd "$(dirname "$0")/../charts/pcp" 2>/dev/null && pwd)}"

if [[ -d "$CHART_DIR" ]] && command -v helm &>/dev/null; then
  HELM_SETS=()
  for svc in "${targets[@]}"; do
    if oc get is/"$svc" &>/dev/null; then
      HELM_SETS+=(--set "${svc}.image.repository=${INT_REG}/${NAMESPACE}/${svc}")
      HELM_SETS+=(--set "${svc}.image.tag=latest")
    fi
  done

  if [[ ${#HELM_SETS[@]} -gt 0 ]]; then
    echo "📦 Helm upgrade: pointing images at internal registry..."
    helm upgrade "$HELM_RELEASE" "$CHART_DIR" --reuse-values "${HELM_SETS[@]}"
    echo "✅ Helm upgrade complete"
    echo ""
  fi
else
  echo "⚠️  Helm or chart dir not found — skipping helm upgrade, falling back to rollout restart"
fi

# ── Cycle deployments ───────────────────────────────────────────────────────
for svc in "${targets[@]}"; do
  DEPLOY_NAME="${HELM_RELEASE}-pcp-${svc}"

  if oc get deployment/"$DEPLOY_NAME" &>/dev/null; then
    echo "🔄 Rolling out: ${DEPLOY_NAME}..."
    oc rollout restart deployment/"$DEPLOY_NAME"
    oc rollout status deployment/"$DEPLOY_NAME" --watch --timeout=120s
    echo "✅ Rollout complete: ${DEPLOY_NAME}"
    echo ""
  elif oc get statefulset/"$DEPLOY_NAME" &>/dev/null; then
    echo "🔄 Rolling out StatefulSet: ${DEPLOY_NAME}..."
    oc rollout restart statefulset/"$DEPLOY_NAME"
    oc rollout status statefulset/"$DEPLOY_NAME" --watch --timeout=120s
    echo "✅ Rollout complete: ${DEPLOY_NAME}"
    echo ""
  else
    echo "⚠️  No deployment/statefulset found for '${DEPLOY_NAME}' — skipping"
  fi
done

# ── Verify pods ─────────────────────────────────────────────────────────────
echo "━━━ Pod Status ━━━"
oc get pods -l app.kubernetes.io/name=pcp -o wide
echo ""
echo "✅ Rollout finished."
