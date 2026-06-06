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
  workers:
    core: quay.io/maximilianopizarro/camel-worker-core:v0.3.0
    messaging: quay.io/maximilianopizarro/camel-worker-messaging:v0.3.0
    http: quay.io/maximilianopizarro/camel-worker-http:v0.3.0
    data: quay.io/maximilianopizarro/camel-worker-data:v0.3.0
    cloud: quay.io/maximilianopizarro/camel-worker-cloud:v0.3.0
    ai: quay.io/maximilianopizarro/camel-worker-ai:v0.3.0
    full: quay.io/maximilianopizarro/camel-worker-full:v0.3.0
```

By default (`preferFullWorker: true`) all ephemeral Camel routes use `camel-worker-full`. Set `preferFullWorker: false` to enable tier selection (core → messaging → http → data → cloud → ai → full).

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
