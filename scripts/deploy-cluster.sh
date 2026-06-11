#!/usr/bin/env bash
# Deploy operator via Quay.io + Helm (no internal registry).
set -euo pipefail

NAMESPACE="${NAMESPACE:-openshift-integration}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_TAG="${VERSION_TAG:-v0.5.0}"

echo "==> Deploying from Quay (${VERSION_TAG})..."
helm upgrade --install openshift-integration-operator \
  "${ROOT}/helm/openshift-integration-operator" \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --set operator.image.repository="quay.io/maximilianopizarro/openshift-integration-operator" \
  --set operator.image.tag="${VERSION_TAG}" \
  --set consolePlugin.image.repository="quay.io/maximilianopizarro/integration-console-plugin" \
  --set consolePlugin.image.tag="${VERSION_TAG}"

echo "==> Waiting for rollouts..."
oc rollout status deployment/openshift-integration-operator -n "$NAMESPACE" --timeout=180s
oc rollout status deployment/integration-console-plugin -n "$NAMESPACE" --timeout=120s

echo "==> Done. Verify with:"
echo "  oc get integrationflow -n $NAMESPACE"
echo "  oc get deploy -l platform.io/ephemeral=true -n $NAMESPACE"
