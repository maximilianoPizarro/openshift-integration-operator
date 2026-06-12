#!/usr/bin/env bash
# Build and push operator + OLM bundle to Quay.io (sole trusted registry).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QUAY_ORG="${QUAY_ORG:-maximilianopizarro}"
VERSION_TAG="${VERSION_TAG:-v0.5.0}"
OPERATOR_IMAGE="quay.io/${QUAY_ORG}/openshift-integration-operator:${VERSION_TAG}"
BUNDLE_IMAGE="quay.io/${QUAY_ORG}/openshift-integration-operator-bundle:${VERSION_TAG}"
CONSOLE_IMAGE="quay.io/${QUAY_ORG}/integration-console-plugin:${VERSION_TAG}"

if ! podman login quay.io --get-login >/dev/null 2>&1; then
  echo "Login first: podman login quay.io"
  exit 1
fi

cd "$ROOT"
mvn -B clean package -DskipTests
operator-sdk bundle validate ./bundle

podman build -f src/main/docker/Dockerfile.jvm -t "${OPERATOR_IMAGE}" -t "quay.io/${QUAY_ORG}/openshift-integration-operator:latest" .
podman push "${OPERATOR_IMAGE}"
podman push "quay.io/${QUAY_ORG}/openshift-integration-operator:latest"

echo "Building console plugin..."
(cd "${ROOT}/console-plugin" && npm ci && npm run build)
podman build -f console-plugin/Dockerfile -t "${CONSOLE_IMAGE}" -t "quay.io/${QUAY_ORG}/integration-console-plugin:latest" console-plugin
podman push "${CONSOLE_IMAGE}"
podman push "quay.io/${QUAY_ORG}/integration-console-plugin:latest"

podman build -f bundle.Dockerfile -t "${BUNDLE_IMAGE}" -t "quay.io/${QUAY_ORG}/openshift-integration-operator-bundle:latest" .
podman push "${BUNDLE_IMAGE}"
podman push "quay.io/${QUAY_ORG}/openshift-integration-operator-bundle:latest"

echo "Building and pushing Camel workers..."
VERSION_TAG="${VERSION_TAG}" "${ROOT}/scripts/publish-workers-quay.sh"

echo "Published (Quay.io only — do not use internal registry):"
echo "  ${OPERATOR_IMAGE}"
echo "  ${CONSOLE_IMAGE}"
echo "  ${BUNDLE_IMAGE}"
echo "Reinstall: operator-sdk cleanup openshift-integration-operator -n openshift-integration"
echo "           operator-sdk run bundle ${BUNDLE_IMAGE} --namespace openshift-integration --install-mode AllNamespaces --timeout 10m"
echo "Optional prune: QUAY_API_TOKEN=... KEEP_TAGS=latest,${VERSION_TAG} ./scripts/prune-quay-tags.sh"
