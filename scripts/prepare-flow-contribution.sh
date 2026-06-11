#!/usr/bin/env bash
# Validate and optionally stamp owner on the Open-Meteo community flow example.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CATALOG="${ROOT}/docs/flow-catalog.json"
YAML="${ROOT}/k8s/examples/22-ephemeral-open-meteo-weather.yaml"
FLOW_NAME="publicapi-open-meteo-weather"
GITHUB_USER_RE='^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$'

usage() {
  cat <<'EOF'
Usage: scripts/prepare-flow-contribution.sh [OPTIONS]

Options:
  --owner USER   Set owner on catalog entry and YAML label (GitHub username, no @)
  --check        Verify example artifacts exist (no validation run)
  --help         Show this help

With no options, runs full catalog validation (validate-ready-flows + validate-catalog).
EOF
}

validate_github_user() {
  local user="$1"
  if [[ ! "$user" =~ $GITHUB_USER_RE ]]; then
    echo "[FAIL] Invalid GitHub username: $user" >&2
    exit 1
  fi
}

stamp_owner() {
  local owner="$1"
  validate_github_user "$owner"
  python3 - "$owner" "$CATALOG" "$YAML" <<'PY'
import json, re, sys
from pathlib import Path

owner, catalog_path, yaml_path = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
flow_name = "publicapi-open-meteo-weather"

data = json.loads(catalog_path.read_text(encoding="utf-8"))
found = False
for cat in data:
    if cat.get("id") != "publicapi":
        continue
    for flow in cat.get("flows", []):
        if flow.get("name") == flow_name:
            flow["owner"] = owner
            found = True
            break

if not found:
    print(f"[FAIL] Flow {flow_name} not found in publicapi category", file=sys.stderr)
    sys.exit(1)

catalog_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

text = yaml_path.read_text(encoding="utf-8")
label_line = f"    platform.io/flow-owner: {owner}"
if "platform.io/flow-owner:" in text:
    text = re.sub(r"    platform\.io/flow-owner:.*", label_line, text)
else:
    text = text.replace("  labels:\n", f"  labels:\n{label_line}\n", 1)
yaml_path.write_text(text, encoding="utf-8")
print(f"[OK] Stamped owner={owner} on catalog and YAML")
PY
}

check_artifacts() {
  local ok=0
  if [[ ! -f "$CATALOG" ]]; then
    echo "[FAIL] Missing $CATALOG" >&2
    ok=1
  fi
  if [[ ! -f "$YAML" ]]; then
    echo "[FAIL] Missing $YAML" >&2
    ok=1
  fi
  if ! python3 -c "import json; json.load(open('$CATALOG'))" 2>/dev/null; then
    echo "[FAIL] $CATALOG is not valid JSON" >&2
    ok=1
  fi
  if ! grep -q "$FLOW_NAME" "$CATALOG"; then
    echo "[FAIL] Catalog missing flow $FLOW_NAME" >&2
    ok=1
  fi
  if [[ $ok -ne 0 ]]; then
    exit 1
  fi
  echo "[OK] Example flow artifacts present"
}

run_validation() {
  node "${ROOT}/scripts/validate-ready-flows.js"
  python3 "${ROOT}/scripts/validate-catalog.py"
  echo "[OK] All contribution validations passed"
}

OWNER=""
MODE="validate"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --owner)
      OWNER="${2:?--owner requires a username}"
      shift 2
      ;;
    --check)
      MODE="check"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -n "$OWNER" ]]; then
  stamp_owner "$OWNER"
fi

case "$MODE" in
  check)
    check_artifacts
    ;;
  validate)
    check_artifacts
    run_validation
    ;;
esac
