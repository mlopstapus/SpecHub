#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# setup-oc.sh — Install the oc CLI and authenticate with an ARO cluster
#
# Designed for Azure Cloud Shell (bash). Also works on any Linux/macOS terminal.
#
# Usage:
#   ./scripts/setup-oc.sh <resource-group> <cluster-name>
#
# Example:
#   ./scripts/setup-oc.sh my-rg my-aro-cluster
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RESOURCE_GROUP="${1:?Usage: $0 <resource-group> <cluster-name>}"
CLUSTER_NAME="${2:?Usage: $0 <resource-group> <cluster-name>}"

echo "━━━ ARO CLI Setup ━━━"
echo "Resource Group: ${RESOURCE_GROUP}"
echo "Cluster:        ${CLUSTER_NAME}"
echo ""

# ── 1. Install oc CLI if not present ─────────────────────────────────────────
if command -v oc &>/dev/null; then
  echo "✅ oc already installed: $(oc version --client 2>/dev/null | head -1)"
else
  echo "📦 Installing oc CLI..."
  OC_URL="https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/openshift-client-linux.tar.gz"

  # Detect macOS vs Linux
  if [[ "$(uname -s)" == "Darwin" ]]; then
    OC_URL="https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/openshift-client-mac.tar.gz"
    if [[ "$(uname -m)" == "arm64" ]]; then
      OC_URL="https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/openshift-client-mac-arm64.tar.gz"
    fi
  fi

  TMPDIR_OC=$(mktemp -d)
  curl -sSL "$OC_URL" | tar xz -C "$TMPDIR_OC"

  # Install to ~/bin (Cloud Shell) or /usr/local/bin
  # Prefer /usr/local/bin (already on PATH); fall back to ~/bin for Cloud Shell
  if [[ -w /usr/local/bin ]]; then
    mv "$TMPDIR_OC/oc" /usr/local/bin/oc
    echo "  Installed to /usr/local/bin/oc"
  elif sudo -n true 2>/dev/null; then
    sudo mv "$TMPDIR_OC/oc" /usr/local/bin/oc
    echo "  Installed to /usr/local/bin/oc"
  else
    mkdir -p "$HOME/bin"
    mv "$TMPDIR_OC/oc" "$HOME/bin/oc"
    export PATH="$HOME/bin:$PATH"
    echo "  Installed to ~/bin/oc"
    # Persist PATH for future shells
    if ! grep -q 'HOME/bin' "$HOME/.bashrc" 2>/dev/null; then
      echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.bashrc"
      echo "  Added ~/bin to PATH in ~/.bashrc"
    fi
  fi

  rm -rf "$TMPDIR_OC"
  echo "✅ oc installed: $(oc version --client 2>/dev/null | head -1)"
fi
echo ""

# ── 2. Get cluster credentials and log in ────────────────────────────────────
echo "🔑 Fetching API server URL..."
API_URL=$(az aro show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CLUSTER_NAME" \
  --query "apiserverProfile.url" \
  -o tsv)
echo "  API Server: ${API_URL}"

echo "🔑 Fetching kubeadmin credentials..."
CREDS=$(az aro list-credentials \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CLUSTER_NAME")
KUBE_USER=$(echo "$CREDS" | jq -r '.kubeadminUsername')
KUBE_PASS=$(echo "$CREDS" | jq -r '.kubeadminPassword')

echo "🔐 Logging in as ${KUBE_USER}..."
oc login "$API_URL" \
  --username="$KUBE_USER" \
  --password="$KUBE_PASS" \
  --insecure-skip-tls-verify=true

echo ""
echo "━━━ Done ━━━"
echo "Logged in as: $(oc whoami)"
echo "Server:       $(oc whoami --show-server)"
echo "Console:      $(az aro show -g "$RESOURCE_GROUP" -n "$CLUSTER_NAME" --query "consoleProfile.url" -o tsv)"
echo ""
echo "Next steps:"
echo "  oc project spechub          # switch to your project"
echo "  ./scripts/rollout.sh        # deploy/rebuild the stack"
