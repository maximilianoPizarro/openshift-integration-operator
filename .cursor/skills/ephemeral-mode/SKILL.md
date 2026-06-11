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

Public API templates: `k8s/examples/10`–`21` (bitcoin, jsonplaceholder, saga-multi-api, etc.).

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
  preferFullWorker: false   # false = tier selection by detected components
  camelWorkerImage: quay.io/maximilianopizarro/camel-worker-core:v0.5.0
  camelWorkerMessagingImage: quay.io/maximilianopizarro/camel-worker-messaging:v0.5.0
  camelWorkerHttpImage: quay.io/maximilianopizarro/camel-worker-http:v0.5.0
  camelWorkerDataImage: quay.io/maximilianopizarro/camel-worker-data:v0.5.0
  camelWorkerCloudImage: quay.io/maximilianopizarro/camel-worker-cloud:v0.5.0
  camelWorkerAiImage: quay.io/maximilianopizarro/camel-worker-ai:v0.5.0
  camelWorkerFullImage: quay.io/maximilianopizarro/camel-worker-full:v0.5.0
  camelTestImage: quay.io/maximilianopizarro/camel-test-runner:v0.5.0
  camelK:
    detect: true
```

Worker tier resolution (`EphemeralWorkerImageResolver`):
- `timer`, `log`, `direct` → core
- `kafka`, `jms` → messaging
- `http`, `https`, `rest`, `jsonpath`, `jackson` → http
- `jdbc`, `sql` → data
- `aws2-s3`, `minio` → cloud
- fallback → full (or full when `preferFullWorker: true`)

Helm maps `EPHEMERAL_PREFER__FULL__WORKER` (Quarkus double-underscore for hyphens).

## REST API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/flows/{name}/ephemeral/extend?seconds=` | Extend TTL |
| POST | `/api/flows/{name}/promote-to-gitops` | Scaffold Git repo and switch to GitOps |

## Code locations

- Deployers: `src/main/java/io/platform/ephemeral/`
- Component detection: `CamelComponentDetector`
- Cleanup: `EphemeralCleanupService` (finalizer `platform.io/ephemeral-cleanup`)
- Reconciler branch: `IntegrationFlowReconciler` when `deploymentMode == EPHEMERAL`
- Console UI: `console-plugin/src/components/ephemeral/` (banner, badge, extend/promote modals)

## Verify

```bash
oc get integrationflow ephemeral-camel-demo -o jsonpath='{.status.phase} {.status.ephemeralWorkerRef}'
oc get deploy -l platform.io/ephemeral=true -n openshift-integration
oc logs deploy/openshift-integration-operator -n openshift-integration --tail=20 | grep -i ephemeral
```

Expected: `status.phase=Running`, worker pod logging timer/route messages.
