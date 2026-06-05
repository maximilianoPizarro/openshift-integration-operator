# Ephemeral Mode Design Spec

**Date:** 2026-06-05  
**Feature:** Quick Try integration flows without Git or ArgoCD

## Goal

Allow users to create an `IntegrationFlow`, see the design in the console, and get runtime in the cluster within minutes—no Git repository, Tekton pipeline, or ArgoCD ApplicationSet required.

## API

```yaml
spec:
  deploymentMode: EPHEMERAL   # GITOPS (default) | EPHEMERAL
  gitRepository: ""         # optional when EPHEMERAL
  ephemeral:
    ttlSeconds: 3600
status:
  deploymentMode: EPHEMERAL
  ephemeralExpiresAt: "2026-06-05T18:00:00Z"
  ephemeralWorkerRef: "deployment/iflow-demo-worker"
  phase: Running | Expired | Building | Error
```

## Runtime strategy by type

| Type | Ephemeral runtime |
|------|-------------------|
| CAMEL_ROUTE | ConfigMap + Deployment + Service |
| CAMEL_KAMELET | camel.apache.org/v1 Kamelet CR |
| CAMEL_PIPE | camel.apache.org/v1 Pipe CR |
| CAMEL_TEST | Job + ConfigMap |
| SONATAFLOW | SonataFlow CR in kogito-bpm |

## Lifecycle

- TTL enforced via annotation and status; expired flows scale to zero
- Finalizer `platform.io/ephemeral-cleanup` removes child resources on delete
- `POST /api/flows/{name}/ephemeral/extend` extends TTL
- `POST /api/flows/{name}/promote-to-gitops` switches to GITOPS and triggers full pipeline

## UX

Console plugin uses PatternFly 5 components per ux.redhat.com guidelines. Quick Try toggle on create; ephemeral badge with countdown on list/detail.
