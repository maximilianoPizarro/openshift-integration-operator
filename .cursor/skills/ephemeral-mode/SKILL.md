---
name: ephemeral-mode
description: Quick Try ephemeral mode — deploy flows without Git, manage TTL, promote to GitOps
---

# Ephemeral (Quick Try) Mode

## CR spec

Set `deploymentMode: EPHEMERAL` and optional TTL:

```yaml
spec:
  deploymentMode: EPHEMERAL
  integrationType: CAMEL_ROUTE
  engine: CAMEL
  ephemeral:
    ttlSeconds: 3600
  kaotoDesign: |
    - route:
        from:
          uri: "timer:tick?period=10000"
          steps:
            - log:
                message: "Hello from ephemeral Quick Try mode"
```

No `gitRepository` required. Example: `k8s/examples/09-ephemeral-demo.yaml`.

## Status fields

| Field | Description |
|---|---|
| `status.phase` | `Running`, `Expired`, `Building`, `Error` |
| `status.ephemeralExpiresAt` | ISO timestamp when TTL expires |
| `status.ephemeralWorkerRef` | e.g. `deployment/ephemeral-camel-demo-worker` |
| `status.deploymentMode` | `EPHEMERAL` |

When TTL expires, phase transitions to `Expired` and worker resources are cleaned up.

## Helm values

```yaml
ephemeral:
  enabled: true
  defaultTtlSeconds: 3600
  maxTtlSeconds: 86400
  camelWorkerImage: quay.io/.../camel-yaml-worker:v0.2.0
```

## REST API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/flows/{name}/ephemeral/extend?seconds=` | Extend TTL |
| POST | `/api/flows/{name}/promote-to-gitops` | Scaffold Git repo and switch to GitOps |

## Code locations

- Deployers: `src/main/java/io/platform/ephemeral/`
- Cleanup: `EphemeralCleanupService` (finalizer `platform.io/ephemeral-cleanup`)
- Reconciler branch: `IntegrationFlowReconciler` when `deploymentMode == EPHEMERAL`
- Console UI: `console-plugin/src/components/ephemeral/` (banner, badge, extend/promote modals)

## Verify

```bash
oc get integrationflow ephemeral-camel-demo -o jsonpath='{.status.phase} {.status.ephemeralWorkerRef}'
oc get deploy -l platform.io/ephemeral=true -n openshift-integration
```
