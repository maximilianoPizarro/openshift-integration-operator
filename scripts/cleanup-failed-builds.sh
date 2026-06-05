#!/usr/bin/env bash
# Clean failed Tekton PipelineRuns and orphaned task pods in openshift-integration.
set -euo pipefail
NS="${1:-openshift-integration}"

echo "Deleting failed PipelineRuns in $NS..."
oc delete pipelinerun -n "$NS" -l platform.io/component=build \
  --field-selector=status.conditions[0].reason=Failed 2>/dev/null || true

oc delete pipelinerun -n "$NS" -l platform.io/component=build \
  --field-selector=status.conditions[0].reason=InvalidWorkspaceBindings 2>/dev/null || true

echo "Deleting failed/completed task pods..."
oc delete pod -n "$NS" --field-selector=status.phase=Failed 2>/dev/null || true

echo "Done. Remaining PipelineRuns:"
oc get pipelinerun -n "$NS" --no-headers 2>/dev/null | wc -l
