#!/usr/bin/env bash
# Build and push all Camel worker images to Quay.io.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QUAY_ORG="${QUAY_ORG:-maximilianopizarro}"
VERSION_TAG="${VERSION_TAG:-v0.8.2}"

WORKERS=(
  camel-worker-core
  camel-worker-messaging
  camel-worker-http
  camel-worker-data
  camel-worker-cloud
  camel-worker-ai
  camel-worker-full
  camel-yaml-worker
  camel-test-runner
)

if ! podman login quay.io --get-login >/dev/null 2>&1; then
  echo "Login first: podman login quay.io"
  exit 1
fi

for worker in "${WORKERS[@]}"; do
  image="quay.io/${QUAY_ORG}/${worker}:${VERSION_TAG}"
  echo "=== Building ${worker} ==="
  podman build -f "${ROOT}/workers/${worker}/Dockerfile.jvm" \
    -t "${image}" \
    -t "quay.io/${QUAY_ORG}/${worker}:latest" \
    "${ROOT}/workers/${worker}"
  podman push "${image}"
  podman push "quay.io/${QUAY_ORG}/${worker}:latest"
done

echo "Published ${#WORKERS[@]} worker images with tag ${VERSION_TAG}"
