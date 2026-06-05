# Ephemeral Mode Implementation Plan

> Design spec: [`docs/superpowers/specs/2026-06-05-ephemeral-mode-design.md`](../specs/2026-06-05-ephemeral-mode-design.md)

## Goal

Allow users to create and run all five integration types without Git, Tekton, or ArgoCD by setting `spec.deploymentMode: EPHEMERAL`.

## Phases

| Phase | Scope | Status |
|-------|-------|--------|
| A | CRD model (`DeploymentMode`, `EphemeralSpec`, status fields, `Expired` phase) | Done |
| B | Reconciler branch + TTL + finalizer cleanup | Done |
| C | `EphemeralRuntimeService` + deployers per type | Done |
| D | Lifecycle API (`extend`, `promote-to-gitops`) | Done |
| E | Helm RBAC + `ephemeral.*` values | Done |
| F | Console Quick Try UI (PatternFly 5) | Done |
| G | Example `09-ephemeral-demo.yaml`, docs, tests | Done |
| H | Cluster verification (Helm 0.2.0 reinstall) | See deploy runbook |

## API Summary

```yaml
spec:
  deploymentMode: EPHEMERAL   # GITOPS | EPHEMERAL (default GITOPS)
  ephemeral:
    ttlSeconds: 3600
  kaotoDesign: |              # required for EPHEMERAL
    ...
status:
  deploymentMode: EPHEMERAL
  ephemeralExpiresAt: "2026-06-05T18:00:00Z"
  ephemeralWorkerRef: "deployment/iflow-demo-worker"
  phase: Running | Expired
```

## Console UX

- **Integration Flows list**: Quick Try toggle on create, Mode column with TTL badge
- **Flow Designer**: info banner, Extend TTL / Promote to GitOps actions; hide GitOps-only links
- **Platform Status**: Ephemeral flow count card

## Verification

```bash
# Apply ephemeral example
oc apply -f k8s/examples/09-ephemeral-demo.yaml

# Watch status
oc get integrationflow ephemeral-camel-demo -w

# Extend TTL (via operator REST API)
curl -X POST "/api/flows/ephemeral-camel-demo/ephemeral/extend?seconds=3600"

# Promote to GitOps
curl -X POST "/api/flows/ephemeral-camel-demo/promote-to-gitops" \
  -H "Content-Type: application/json" \
  -d '{"gitRepository":"https://gitea.example.com/org/repo","branch":"main"}'
```

## Helm Configuration

```yaml
ephemeral:
  enabled: true
  defaultTtlSeconds: 3600
  maxTtlSeconds: 86400
  camelWorkerImage: quay.io/maximilianopizarro/camel-yaml-worker:v0.2.0
  camelTestImage: quay.io/maximilianopizarro/camel-test-runner:v0.2.0
  camelK:
    detect: true
```
