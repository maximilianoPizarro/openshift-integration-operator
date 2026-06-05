#!/usr/bin/env bash
# Clean Tekton PipelineRuns and orphaned build PVCs in openshift-integration.
set -euo pipefail
NS="${1:-openshift-integration}"

echo "Deleting PipelineRuns (platform.io/component=build) in $NS..."
oc delete pipelinerun -n "$NS" -l platform.io/component=build --ignore-not-found --wait=false 2>/dev/null || true

echo "Deleting failed/completed Tekton task pods..."
oc delete pod -n "$NS" -l tekton.dev/pipelineRun --field-selector=status.phase!=Running --ignore-not-found 2>/dev/null || true

echo "Deleting orphaned build PVCs (iflow-build-* / pvc from pipelineruns)..."
oc get pvc -n "$NS" -o name 2>/dev/null | while read -r pvc; do
  oc delete "$pvc" -n "$NS" --ignore-not-found 2>/dev/null || true
done

echo "Done. Remaining PipelineRuns:"
oc get pipelinerun -n "$NS" --no-headers 2>/dev/null | wc -l
