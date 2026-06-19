#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NAMESPACE="${NAMESPACE:-openshift-integration}"
FLOW_NAME="${FLOW_NAME:-ephemeral-camel-demo}"
KIND_CLUSTER_NAME="${KIND_CLUSTER_NAME:-iflow-smoke}"
KIND_WAIT_SECONDS="${KIND_WAIT_SECONDS:-180s}"
CREATE_CLUSTER="${SMOKE_KIND_CREATE_CLUSTER:-true}"

OPERATOR_IMAGE="${OPERATOR_IMAGE:-}"
WORKER_TAG="${WORKER_TAG:-}"
WORKER_REPO_PREFIX="${WORKER_REPO_PREFIX:-quay.io/maximilianopizarro}"

if [[ -z "$OPERATOR_IMAGE" ]]; then
  echo "OPERATOR_IMAGE is required (example: quay.io/maximilianopizarro/openshift-integration-operator:v0.8.2)"
  exit 1
fi

if [[ -z "$WORKER_TAG" ]]; then
  echo "WORKER_TAG is required (example: v0.8.2)"
  exit 1
fi

if ! command -v kind >/dev/null 2>&1; then
  echo "kind binary not found in PATH"
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl binary not found in PATH"
  exit 1
fi

if ! command -v helm >/dev/null 2>&1; then
  echo "helm binary not found in PATH"
  exit 1
fi

OPERATOR_REPOSITORY="${OPERATOR_IMAGE%:*}"
OPERATOR_TAG="${OPERATOR_IMAGE##*:}"

cleanup() {
  local exit_code=$?
  if [[ "${CREATE_CLUSTER}" == "true" ]]; then
    kind delete cluster --name "$KIND_CLUSTER_NAME" >/dev/null 2>&1 || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT

if [[ "${CREATE_CLUSTER}" == "true" ]]; then
  kind delete cluster --name "$KIND_CLUSTER_NAME" >/dev/null 2>&1 || true
  kind create cluster --name "$KIND_CLUSTER_NAME" --wait "$KIND_WAIT_SECONDS"
fi

kubectl get nodes
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f bundle/manifests/integrationflows.platform.io-v1.crd.yml

helm upgrade --install openshift-integration-operator ./helm/openshift-integration-operator \
  --namespace "$NAMESPACE" \
  --set operator.image.repository="$OPERATOR_REPOSITORY" \
  --set operator.image.tag="$OPERATOR_TAG" \
  --set operator.image.pullPolicy=Always \
  --set consolePlugin.enabled=false \
  --set kaoto.enabled=false \
  --set sonataflow.enabled=false \
  --set argocd.enabled=false \
  --set flowCatalog.source=configmap \
  --set ephemeral.camelWorkerImage="${WORKER_REPO_PREFIX}/camel-worker-core:${WORKER_TAG}" \
  --set ephemeral.camelWorkerMessagingImage="${WORKER_REPO_PREFIX}/camel-worker-messaging:${WORKER_TAG}" \
  --set ephemeral.camelWorkerHttpImage="${WORKER_REPO_PREFIX}/camel-worker-http:${WORKER_TAG}" \
  --set ephemeral.camelWorkerDataImage="${WORKER_REPO_PREFIX}/camel-worker-data:${WORKER_TAG}" \
  --set ephemeral.camelWorkerCloudImage="${WORKER_REPO_PREFIX}/camel-worker-cloud:${WORKER_TAG}" \
  --set ephemeral.camelWorkerAiImage="${WORKER_REPO_PREFIX}/camel-worker-ai:${WORKER_TAG}" \
  --set ephemeral.camelWorkerFullImage="${WORKER_REPO_PREFIX}/camel-worker-full:${WORKER_TAG}" \
  --set ephemeral.camelTestImage="${WORKER_REPO_PREFIX}/camel-test-runner:${WORKER_TAG}"

kubectl -n "$NAMESPACE" rollout status deployment/openshift-integration-operator --timeout=240s
kubectl apply -f k8s/examples/09-ephemeral-demo.yaml

echo "Waiting for IntegrationFlow phase=Running..."
running="false"
for _ in $(seq 1 72); do
  phase="$(kubectl -n "$NAMESPACE" get integrationflow "$FLOW_NAME" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
  message="$(kubectl -n "$NAMESPACE" get integrationflow "$FLOW_NAME" -o jsonpath='{.status.message}' 2>/dev/null || true)"
  if [[ "$phase" == "Running" ]]; then
    running="true"
    break
  fi
  if [[ "$phase" == "Error" || "$phase" == "Expired" ]]; then
    echo "Flow reached terminal phase: $phase"
    echo "Message: $message"
    kubectl -n "$NAMESPACE" get integrationflow "$FLOW_NAME" -o yaml
    exit 1
  fi
  sleep 5
done

if [[ "$running" != "true" ]]; then
  echo "Flow did not become Running in time"
  kubectl -n "$NAMESPACE" get integrationflow "$FLOW_NAME" -o yaml
  kubectl -n "$NAMESPACE" get pods
  exit 1
fi

WORKER_DEPLOYMENT="iflow-${FLOW_NAME}-worker"
kubectl -n "$NAMESPACE" rollout status "deployment/${WORKER_DEPLOYMENT}" --timeout=240s

echo "Waiting for expected log line..."
found="false"
for _ in $(seq 1 30); do
  if kubectl -n "$NAMESPACE" logs "deployment/${WORKER_DEPLOYMENT}" --tail=200 | rg -q "Hello from ephemeral Quick Try mode"; then
    found="true"
    break
  fi
  sleep 4
done

if [[ "$found" != "true" ]]; then
  echo "Expected log line not found"
  kubectl -n "$NAMESPACE" logs "deployment/${WORKER_DEPLOYMENT}" --tail=300 || true
  exit 1
fi

echo "Kind smoke test passed."
