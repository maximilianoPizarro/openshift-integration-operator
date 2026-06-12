#!/usr/bin/env bash
# Smoke-test ephemeral AI on OpenShift (requires OPENAI_API_KEY secret).
set -euo pipefail

NS="${NAMESPACE:-openshift-integration}"
EXAMPLE="${1:-k8s/examples/ephemeral-ai/01-openai-simple-chat.yaml}"
FLOW_NAME="${2:-ephemeral-ai-simple-chat}"

if ! oc whoami &>/dev/null; then
  echo "oc login required"
  exit 1
fi

if ! oc get secret openai-credentials -n "$NS" &>/dev/null; then
  echo "Create secret first:"
  echo "  oc create secret generic openai-credentials -n $NS --from-literal=OPENAI_API_KEY=sk-..."
  exit 1
fi

echo "Applying $EXAMPLE"
oc apply -f "$EXAMPLE"

echo "Waiting for phase Running..."
for i in $(seq 1 60); do
  phase=$(oc get integrationflow "$FLOW_NAME" -n "$NS" -o jsonpath='{.status.phase}' 2>/dev/null || true)
  echo "  phase=$phase ($i/60)"
  if [[ "$phase" == "Running" ]]; then break; fi
  if [[ "$phase" == "Error" ]]; then
    oc get integrationflow "$FLOW_NAME" -n "$NS" -o yaml | tail -30
    exit 1
  fi
  sleep 5
done

deploy="iflow-${FLOW_NAME}-worker"
echo "Worker logs (last 40 lines):"
oc logs "deploy/${deploy}" -n "$NS" --tail=40 2>/dev/null || oc logs -l "platform.io/flow-name=${FLOW_NAME}" -n "$NS" --tail=40

echo "Done. phase=$(oc get integrationflow "$FLOW_NAME" -n "$NS" -o jsonpath='{.status.phase}')"
