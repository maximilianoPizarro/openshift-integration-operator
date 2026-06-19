#!/usr/bin/env bash
# Fail if active docs contain stale version strings or n8n positioning (changelog history exempt).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAIL=0

while IFS= read -r -d '' file; do
  base="$(basename "$file")"
  if [ "$base" = "changelog.html" ]; then
    continue
  fi
  if rg -q 'v0\.[0-5]\.' "$file" 2>/dev/null; then
    echo "FAIL: stale version v0.[0-5].* in $file"
    rg -n 'v0\.[0-5]\.' "$file" || true
    FAIL=1
  fi
  if rg -qi 'n8n' "$file" 2>/dev/null; then
    echo "FAIL: n8n reference in active doc $file"
    rg -ni 'n8n' "$file" || true
    FAIL=1
  fi
done < <(find docs -name '*.html' -print0)

if rg -q 'v0\.[0-5]\.' docs/demo-script.md 2>/dev/null; then
  echo "FAIL: stale version in docs/demo-script.md"
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "Docs version check passed."
