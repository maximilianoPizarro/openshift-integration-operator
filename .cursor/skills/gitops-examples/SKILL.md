---
name: gitops-examples
description: Deploy and verify the eight GitOps catalog example flows with Tekton and Argo CD
---

# GitOps Example Flows

Eight IntegrationFlows in `k8s/examples/` demonstrate the full GitOps pipeline:

```
IntegrationFlow → scaffold push (Gitea) → Tekton PipelineRun → image :latest
                → Argo CD ApplicationSet → sync base/ manifests
```

## Examples

| File | Name | Type | Runtime |
|------|------|------|---------|
| `01-rest-to-kafka.yaml` | rest-to-kafka | CAMEL_ROUTE | Deployment `iflow-rest-to-kafka` |
| `02-order-routing-cbr.yaml` | order-routing-cbr | CAMEL_ROUTE | Deployment |
| `03-parallel-enrichment.yaml` | parallel-enrichment | CAMEL_ROUTE | Deployment |
| `04-error-handling-dlq.yaml` | error-handling-dlq | CAMEL_ROUTE | Deployment |
| `05-s3-to-db-kamelet.yaml` | s3-to-db-kamelet | CAMEL_KAMELET | Kamelet CR |
| `06-etl-pipe.yaml` | etl-pipe | CAMEL_PIPE | Camel K Pipe |
| `07-file-processor-workflow.yaml` | file-processor-workflow | SONATAFLOW | SonataFlow CR in `kogito-bpm` |
| `08-saga-workflow.yaml` | saga-workflow | SONATAFLOW | SonataFlow CR in `kogito-bpm` |

Placeholder `gitRepository: https://gitea.example.com/user1/<flow>` is rewritten to cluster Gitea by the operator.

## Prerequisites

1. Operator deployed (see `deploy-to-openshift` skill) with:
   - `tekton.approvalEnabled=false`
   - `gitea.password` set
2. Camel K bootstrap for Pipe/Kamelet (`k8s/bootstrap/camel-k-platform.yaml` + `camel-k-registry-auth`)
3. SonataFlow operator in `kogito-bpm` (workshop clusters usually pre-installed)

## Apply flows

Apply **sequentially** (concurrent reconciles cause Gitea HTTP 500):

```bash
for yaml in 01-rest-to-kafka 02-order-routing-cbr 03-parallel-enrichment \
  04-error-handling-dlq 05-s3-to-db-kamelet 06-etl-pipe \
  07-file-processor-workflow 08-saga-workflow; do
  oc apply -f "k8s/examples/${yaml}.yaml"
  sleep 12
done
```

## Verify pipeline (Tekton)

```bash
oc get pipelinerun -n openshift-integration \
  -l platform.io/component=build \
  --sort-by=.metadata.creationTimestamp

# Latest run per flow
oc get pipelinerun -n openshift-integration -o json | python3 -c "
import json,sys
from collections import defaultdict
by=defaultdict(list)
for r in json.load(sys.stdin)['items']:
 fn=r['metadata']['labels'].get('platform.io/flow-name')
 if fn: by[fn].append((r['metadata']['creationTimestamp'],
   r['status']['conditions'][0]['status']))
for f in sorted(by): print(f, sorted(by[f])[-1][1])
"
```

Pipeline: `integration-flow-build` (Helm `templates/tekton-pipeline.yaml`).
- `build-maven` → `mvn package` (JDK 17)
- `build-image` → Dockerfile copies `target/quarkus-app` (no in-container rebuild)

Images: `image-registry.../openshift-integration/<flow-name>:latest`

## Verify Argo CD

```bash
oc get applications -n openshift-gitops | grep in-cluster
```

Expected: `Synced` + `Healthy` for Camel routes, Pipe, Kamelet. SonataFlow apps may show `OutOfSync` while `Healthy` (operator also creates CR in `kogito-bpm`).

## Verify runtime

```bash
# Camel routes
oc get deploy -n openshift-integration | grep iflow-

# Camel K
oc get pipe etl-pipe -n openshift-integration
oc get kamelet s3-to-db-kamelet-source -n openshift-integration

# SonataFlow
oc get sonataflow -n kogito-bpm | grep iflow
oc get pods -n kogito-bpm | grep iflow

# IntegrationFlow phases
oc get integrationflow -n openshift-integration \
  -o custom-columns=NAME:.metadata.name,PHASE:.status.phase
```

All eight should reach `Running`.

## Scaffold / Git layout (operator-generated)

Pushed to Gitea per flow:

| Path | Purpose |
|------|---------|
| `pom.xml` | Quarkus 3.36, `maven.compiler.release=17`, `quarkus-maven-plugin` |
| `Dockerfile` | Runtime-only: `COPY target/quarkus-app` |
| `src/main/resources/routes/flow.camel.yaml` | Camel routes (or `workflows/flow.sw.yaml` for SonataFlow) |
| `base/kustomization.yaml` | Kustomize entry |
| `base/deployment.yaml` + `service.yaml` | Camel routes |
| `base/pipe.yaml` / `base/kamelet.yaml` / `base/sonataflow.yaml` | Per integration type |

Generator: `GitOpsManifestGenerator.java`, push: `DefaultGitOpsService.java`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ImagePullBackOff` on `iflow-*` | Image built after deploy → `oc rollout restart deployment/iflow-<name>` |
| Pipeline maven Java 5 / 21 errors | Redeploy operator; recreate flow for fresh scaffold |
| `etl-pipe` stuck Creating | Camel K platform + registry secret (deploy skill) |
| Flow `PartiallyHealthy`, pod OK | `oc annotate application <name>-in-cluster -n openshift-gitops argocd.argoproj.io/refresh=hard --overwrite` |
| SonataFlow pipeline fails | Workflows still run via operator CR; pipeline POM uses `kogito-bom` 10.1.0 |

## Recreate single flow

```bash
oc delete integrationflow <name> -n openshift-integration --wait=true
oc apply -f k8s/examples/<NN>-<name>.yaml
```
