#!/usr/bin/env bash
# Import flow-catalog.json as a ConfigMap and enable offline catalog mode on the operator.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="${NAMESPACE:-openshift-integration}"
CONFIG_MAP_NAME="${CONFIG_MAP_NAME:-flow-catalog}"
CONFIG_MAP_KEY="${CONFIG_MAP_KEY:-flow-catalog.json}"
CATALOG_FILE="${CATALOG_FILE:-${ROOT}/docs/flow-catalog.json}"
OPERATOR_DEPLOY="${OPERATOR_DEPLOY:-openshift-integration-operator}"

if [[ ! -f "${CATALOG_FILE}" ]]; then
  echo "ERROR: catalog file not found: ${CATALOG_FILE}" >&2
  exit 1
fi

echo "Creating/updating ConfigMap ${CONFIG_MAP_NAME} in ${NAMESPACE}..."
oc create configmap "${CONFIG_MAP_NAME}" \
  --from-file="${CONFIG_MAP_KEY}=${CATALOG_FILE}" \
  -n "${NAMESPACE}" \
  --dry-run=client -o yaml | oc apply -f -

echo "Patching operator Deployment ${OPERATOR_DEPLOY} for offline catalog mode..."
oc set env deployment/"${OPERATOR_DEPLOY}" -n "${NAMESPACE}" \
  FLOW_CATALOG_SOURCE=configmap \
  FLOW_CATALOG_CONFIG_MAP_NAME="${CONFIG_MAP_NAME}" \
  FLOW_CATALOG_CONFIG_MAP_KEY="${CONFIG_MAP_KEY}"

echo "Waiting for operator rollout..."
oc rollout status deployment/"${OPERATOR_DEPLOY}" -n "${NAMESPACE}" --timeout=120s

echo ""
echo "Done. Verify:"
echo "  oc get configmap ${CONFIG_MAP_NAME} -n ${NAMESPACE}"
echo "  Overview page should show: Catalog: configmap"
echo "  Browse Templates in Create Flow should load from the ConfigMap."
