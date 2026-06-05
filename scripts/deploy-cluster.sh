#!/usr/bin/env bash
# Deploy operator + console plugin to OpenShift using internal ImageStreams.
set -euo pipefail

NAMESPACE="${NAMESPACE:-openshift-integration}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Applying CRD..."
oc apply -f "$ROOT/target/kubernetes/integrationflows.platform.io-v1.yml"

echo "==> Building operator image (binary build)..."
oc start-build openshift-integration-operator --from-dir="$ROOT" --follow -n "$NAMESPACE"

echo "==> Ensuring console plugin BuildConfig..."
oc apply -f "$ROOT/k8s/console-plugin-buildconfig.yaml" 2>/dev/null || true
oc get imagestream integration-console-plugin -n "$NAMESPACE" 2>/dev/null || \
  oc create imagestream integration-console-plugin -n "$NAMESPACE"

echo "==> Building console plugin image..."
oc start-build integration-console-plugin --from-dir="$ROOT/console-plugin" --follow -n "$NAMESPACE"

echo "==> Helm upgrade..."
helm upgrade --install openshift-integration-operator "$ROOT/helm/openshift-integration-operator" \
  --namespace "$NAMESPACE" \
  --set operator.image.repository="image-registry.openshift-image-registry.svc:5000/$NAMESPACE/openshift-integration-operator" \
  --set operator.image.tag=latest \
  --set consolePlugin.image.repository="image-registry.openshift-image-registry.svc:5000/$NAMESPACE/integration-console-plugin" \
  --set consolePlugin.image.tag=latest

echo "==> Waiting for rollouts..."
oc rollout status deployment/openshift-integration-operator -n "$NAMESPACE" --timeout=180s
oc rollout status deployment/integration-console-plugin -n "$NAMESPACE" --timeout=180s

echo "==> Done. Verify with:"
echo "  oc get integrationflow ephemeral-camel-demo -n $NAMESPACE"
echo "  oc get deploy -l platform.io/ephemeral=true -n $NAMESPACE"
