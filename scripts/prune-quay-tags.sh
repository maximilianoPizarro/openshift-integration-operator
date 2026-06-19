#!/usr/bin/env bash
# Remove stale Quay.io tags; keep version tags listed in KEEP_TAGS and 'latest'.
set -euo pipefail

QUAY_ORG="${QUAY_ORG:-maximilianopizarro}"
KEEP_TAGS="${KEEP_TAGS:-latest,v0.8.1}"

resolve_quay_token() {
  if [[ -n "${QUAY_API_TOKEN:-}" ]]; then
    echo "$QUAY_API_TOKEN"
    return
  fi
  if [[ -n "${QUAY_USERNAME:-}" && -n "${QUAY_PASSWORD:-}" ]]; then
    curl -fsS -X POST -H "Content-Type: application/json" \
      -d "{\"username\":\"${QUAY_USERNAME}\",\"password\":\"${QUAY_PASSWORD}\"}" \
      "https://quay.io/api/v1/signin" \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])"
    return
  fi
  echo "Set QUAY_API_TOKEN or QUAY_USERNAME+QUAY_PASSWORD" >&2
  exit 1
}

QUAY_API_TOKEN="$(resolve_quay_token)"

REPOS=(
  openshift-integration-operator
  openshift-integration-operator-bundle
  integration-console-plugin
  camel-worker-core
  camel-worker-messaging
  camel-worker-http
  camel-worker-data
  camel-worker-cloud
  camel-worker-ai
  camel-worker-full
  camel-test-runner
)

should_keep() {
  local tag="$1"
  IFS=',' read -ra keep <<< "$KEEP_TAGS"
  for k in "${keep[@]}"; do
    if [[ "$tag" == "$k" ]]; then
      return 0
    fi
  done
  return 1
}

prune_repo() {
  local repo="$1"
  local page=1
  local deleted=0

  while true; do
    resp=$(curl -fsS -H "Authorization: Bearer ${QUAY_API_TOKEN}" \
      "https://quay.io/api/v1/repository/${QUAY_ORG}/${repo}/tag/?limit=100&page=${page}")
    tags=$(echo "$resp" | python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(t['name'] for t in d.get('tags',[])))")
    if [[ -z "$tags" ]]; then
      break
    fi
    while IFS= read -r tag; do
      [[ -z "$tag" ]] && continue
      if should_keep "$tag"; then
        echo "KEEP ${QUAY_ORG}/${repo}:${tag}"
        continue
      fi
      echo "DELETE ${QUAY_ORG}/${repo}:${tag}"
      curl -fsS -X DELETE -H "Authorization: Bearer ${QUAY_API_TOKEN}" \
        "https://quay.io/api/v1/repository/${QUAY_ORG}/${repo}/tag/${tag}" >/dev/null
      deleted=$((deleted + 1))
    done <<< "$tags"
    has_more=$(echo "$resp" | python3 -c "import json,sys; print('yes' if json.load(sys.stdin).get('has_additional') else 'no')")
    [[ "$has_more" == "yes" ]] || break
    page=$((page + 1))
  done
  echo "Pruned ${deleted} tag(s) from ${repo}"
}

for repo in "${REPOS[@]}"; do
  prune_repo "$repo"
done

echo "Done. Kept tags: ${KEEP_TAGS}"
