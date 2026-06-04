# OpenShift Integration Operator

![Version: 0.2.0](https://img.shields.io/badge/Version-0.2.0-informational?style=flat-square)
![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square)
![AppVersion: v0.2.0](https://img.shields.io/badge/AppVersion-v0.2.0-informational?style=flat-square)
![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg?style=flat-square)

Real-Time Integration & Orchestration Platform for OpenShift — an open-source alternative to n8n, powered by Apache Camel + CNCF SonataFlow with a visual Kaoto designer embedded in the OpenShift Console.

## Features

- **Five Integration Types** — Run Camel Routes, Kamelets, Pipes, Tests, or SonataFlow workflows from a single `IntegrationFlow` Custom Resource
- **Multi-Provider Git** — Connect to Gitea, GitHub, or GitLab for scaffolded worker source with auto-detection
- **Visual Designer** — Kaoto canvas embedded in the OpenShift Console via a Dynamic Plugin
- **GitOps Native** — Tekton builds container images; ArgoCD syncs worker deployments from Git
- **MCP/AI Ready** — Model Context Protocol bridge for discovering and invoking AI tools within integration flows
- **Observable** — OpenTelemetry instrumentation with real-time SSE telemetry for canvas node coloring
- **Auto-scaling Workers** — HPA v2-driven worker pods scale on CPU and memory utilization
- **Multi-cluster** — Target multiple clusters from a single IntegrationFlow spec via ArgoCD ApplicationSets

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  OpenShift Console                                       │
│  ┌─────────────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Console Plugin   │ │ Kaoto    │ │ Telemetry Overlay│  │
│  └────────┬────────┘ └──────────┘ └──────────────────┘  │
├───────────┼──────────────────────────────────────────────┤
│  Operator │ (Quarkus + JOSDK + Fabric8)                  │
│  ┌────────┴────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Reconciler      │ │ Scaffold │ │ MCP Bridge       │  │
│  │ IntegrationFlow │ │ Service  │ │ AI Tool Gateway  │  │
│  └────────┬────────┘ └────┬─────┘ └──────────────────┘  │
├───────────┼───────────────┼──────────────────────────────┤
│  GitOps   │               │                              │
│  ┌────────▼────┐  ┌───────▼──────┐  ┌───────────────┐   │
│  │ Gitea Repo  │→ │ Tekton Build │→ │ ArgoCD Sync   │   │
│  └─────────────┘  └──────────────┘  └───────┬───────┘   │
├──────────────────────────────────────────────┼───────────┤
│  Workers (HPA auto-scaled)                   │           │
│  ┌─────────────────┐  ┌─────────────────┐   │           │
│  │ Camel Workers   │  │ SonataFlow      │◄──┘           │
│  └─────────────────┘  └─────────────────┘               │
└──────────────────────────────────────────────────────────┘
```

## Prerequisites

| Component | Version | Purpose |
|---|---|---|
| OpenShift | 4.14+ | Target cluster platform |
| Helm | 3.x | Chart installation |
| oc CLI | 4.14+ | Cluster interaction |
| Gitea | any | Git server for scaffolded worker source |
| ArgoCD / OpenShift GitOps | any | GitOps controller for deployments |
| Tekton / OpenShift Pipelines | any | CI pipeline for container image builds |
| OTel Collector | any | (Optional) Telemetry aggregation |

## Installation

### Add Helm Repository

```bash
helm repo add integration-platform \
  https://maximilianopizarro.github.io/openshift-integration-operator/

helm repo update
```

### Install the Operator

```bash
helm install integration-operator \
  integration-platform/openshift-integration-operator \
  --namespace openshift-integration \
  --create-namespace
```

### Install with Custom Values

```bash
helm install integration-operator \
  integration-platform/openshift-integration-operator \
  --namespace openshift-integration \
  --create-namespace \
  --set operator.image.tag=v0.2.0 \
  --set workers.maxReplicas=20 \
  --set telemetry.otelCollectorEndpoint=http://my-otel:4317
```

### Upgrade

```bash
helm upgrade integration-operator \
  integration-platform/openshift-integration-operator \
  --namespace openshift-integration \
  --reuse-values
```

### Uninstall

```bash
helm uninstall integration-operator --namespace openshift-integration
```

## Configuration

### Operator

| Parameter | Description | Default |
|---|---|---|
| `operator.image.repository` | Operator container image | `quay.io/maximilianopizarro/openshift-integration-operator` |
| `operator.image.tag` | Image tag | `v0.2.0` |
| `operator.image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `operator.replicas` | Number of operator replicas | `1` |
| `operator.resources.requests.cpu` | CPU request | `250m` |
| `operator.resources.requests.memory` | Memory request | `512Mi` |
| `operator.resources.limits.cpu` | CPU limit | `1000m` |
| `operator.resources.limits.memory` | Memory limit | `1Gi` |
| `operator.serviceAccount.create` | Create ServiceAccount | `true` |
| `operator.serviceAccount.name` | ServiceAccount name | `integration-operator-sa` |

### Workers (HPA)

| Parameter | Description | Default |
|---|---|---|
| `workers.enabled` | Enable worker HPA configuration | `true` |
| `workers.minReplicas` | Minimum worker replicas | `1` |
| `workers.maxReplicas` | Maximum worker replicas | `10` |
| `workers.targetCPUUtilization` | CPU utilization threshold (%) | `70` |
| `workers.targetMemoryUtilization` | Memory utilization threshold (%) | `80` |
| `workers.resources.requests.cpu` | Worker CPU request | `500m` |
| `workers.resources.requests.memory` | Worker memory request | `512Mi` |
| `workers.resources.limits.cpu` | Worker CPU limit | `2000m` |
| `workers.resources.limits.memory` | Worker memory limit | `2Gi` |

### Telemetry

| Parameter | Description | Default |
|---|---|---|
| `telemetry.enabled` | Enable OpenTelemetry integration | `true` |
| `telemetry.otelCollectorEndpoint` | OTel Collector gRPC endpoint | `http://integration-otel-collector:4317` |

### Git

| Parameter | Description | Default |
|---|---|---|
| `git.provider` | Git provider (`auto`, `gitea`, `github`, `gitlab`) | `auto` |
| `git.url` | Base API URL (empty = auto-detect from `gitRepository` in CR) | `""` |
| `git.username` | Git username | `""` |
| `git.password` | Git password / token | `""` |
| `git.org` | Git organization or owner | `""` |

> **Backward compatibility:** The legacy `gitea.*` values still work. If both `git.*` and `gitea.*` are set, the more specific one wins for each env var.

| Parameter | Description | Default |
|---|---|---|
| `gitea.url` | (Legacy) Gitea API URL | `""` |
| `gitea.username` | (Legacy) Gitea username | `""` |
| `gitea.password` | (Legacy) Gitea password | `""` |
| `gitea.org` | (Legacy) Gitea organization | `""` |

### ArgoCD

| Parameter | Description | Default |
|---|---|---|
| `argocd.enabled` | Enable ArgoCD integration | `true` |
| `argocd.namespace` | ArgoCD installation namespace | `openshift-gitops` |

### Kaoto

| Parameter | Description | Default |
|---|---|---|
| `kaoto.enabled` | Enable Kaoto visual designer | `true` |
| `kaoto.instanceUrl` | Kaoto instance URL (auto-detected if empty) | `""` |

### Console Plugin

| Parameter | Description | Default |
|---|---|---|
| `consolePlugin.enabled` | Deploy the OpenShift Console Dynamic Plugin | `true` |
| `consolePlugin.image.repository` | Console plugin container image | `quay.io/maximilianopizarro/integration-console-plugin` |
| `consolePlugin.image.tag` | Console plugin image tag | `v0.2.0` |
| `consolePlugin.replicas` | Console plugin replicas | `1` |

### General

| Parameter | Description | Default |
|---|---|---|
| `namespace` | Target namespace for all resources | `openshift-integration` |

## Multi-Provider Git

The operator supports **Gitea**, **GitHub**, and **GitLab** as the backing Git provider for scaffolded worker source. Set `git.provider` to `auto` (default) and the operator will detect the provider from the `gitRepository` URL in each `IntegrationFlow` CR. You can also pin it explicitly:

### Gitea (default / legacy)

```bash
helm install integration-operator \
  integration-platform/openshift-integration-operator \
  --set git.provider=gitea \
  --set git.url=https://gitea.example.com \
  --set git.username=user1 \
  --set git.password=changeme \
  --set git.org=user1
```

### GitHub

```bash
helm install integration-operator \
  integration-platform/openshift-integration-operator \
  --set git.provider=github \
  --set git.url=https://api.github.com \
  --set git.username=my-bot \
  --set git.password=ghp_xxxxxxxxxxxx \
  --set git.org=my-org
```

### GitLab

```bash
helm install integration-operator \
  integration-platform/openshift-integration-operator \
  --set git.provider=gitlab \
  --set git.url=https://gitlab.com \
  --set git.username=oauth2 \
  --set git.password=glpat-xxxxxxxxxxxx \
  --set git.org=my-group
```

## Custom Resource: IntegrationFlow

The operator watches `IntegrationFlow` custom resources in the `platform.io/v1alpha1` API group (short name: `iflow`).

### Spec

| Field | Type | Description |
|---|---|---|
| `engine` | enum | `CAMEL` or `SONATAFLOW` — selects the worker runtime engine |
| `gitRepository` | string | Git remote URL for scaffolded worker source |
| `branch` | string | Git branch (default: `main`) |
| `targetClusters` | []string | Clusters where ArgoCD deploys the worker |
| `kaotoDesign` | string | Raw Kaoto design — YAML for Camel routes, JSON/YAML for SonataFlow |

### Status

| Field | Type | Description |
|---|---|---|
| `phase` | enum | `Scaffolding` → `Building` → `Deploying` → `Running` / `Error` |
| `gitCommitHash` | string | SHA of the last successful Git push |
| `argoApplicationName` | string | ArgoCD Application name (e.g. `iflow-<name>`) |
| `message` | string | Human-readable status or error message |

### Example: Apache Camel Flow

```yaml
apiVersion: platform.io/v1alpha1
kind: IntegrationFlow
metadata:
  name: sample-camel-flow
  namespace: openshift-integration
spec:
  engine: CAMEL
  gitRepository: https://gitea.example.com/demo/sample-camel-worker.git
  branch: main
  targetClusters:
    - local
  kaotoDesign: |
    - route:
        from:
          uri: timer:tick
          parameters:
            period: 5000
          steps:
            - set-body:
                simple: "Hello from IntegrationFlow at ${header.firedTime}"
            - log:
                message: "${body}"
```

### Example: SonataFlow Workflow

```yaml
apiVersion: platform.io/v1alpha1
kind: IntegrationFlow
metadata:
  name: order-processing
  namespace: openshift-integration
spec:
  engine: SONATAFLOW
  gitRepository: https://gitea.example.com/demo/order-workflow.git
  branch: main
  targetClusters:
    - local
  kaotoDesign: |
    id: order-processing
    specVersion: "0.8"
    name: Order Processing Workflow
    start: EvaluateRequest
    states:
      - name: EvaluateRequest
        type: switch
        dataConditions:
          - condition: "${ .priority == \"high\" }"
            transition: CallExternalAPI
        defaultCondition:
          transition: TransformData
      - name: CallExternalAPI
        type: operation
        actions:
          - name: invoke-api
            functionRef: httpCall
        transition: NotifyResult
      - name: TransformData
        type: inject
        data:
          processed: true
        transition: NotifyResult
      - name: NotifyResult
        type: operation
        actions:
          - name: notify
            functionRef: logMessage
        end: true
```

## RBAC Permissions

The operator ClusterRole includes permissions for:

| API Group | Resources | Verbs |
|---|---|---|
| `apiextensions.k8s.io` | `customresourcedefinitions` | get, list, watch, create, update, patch |
| `platform.io` | `integrationflows`, `integrationflows/status`, `integrationflows/finalizers` | get, list, watch, create, update, patch, delete |
| `tekton.dev` | `pipelineruns` | get, list, watch, create, delete |
| `argoproj.io` | `applications`, `applicationsets` | get, list, watch, create, update, patch |
| `""` (core) | `configmaps`, `secrets`, `services`, `events` | get, list, watch, create, update, patch |
| `apps` | `deployments` | get, list, watch, create, update, patch, delete |

## API Endpoints

The operator exposes the following REST endpoints on port 8080:

| Method | Path | Description |
|---|---|---|
| GET | `/api/telemetry/stream/{flowId}` | SSE stream of real-time node telemetry |
| GET | `/api/telemetry/snapshot/{flowId}` | Point-in-time snapshot of node status |
| GET | `/api/mcp/tools?serverUrl=<url>` | List available MCP tools from a server |
| POST | `/api/mcp/tools/{toolName}/call?serverUrl=<url>` | Invoke an MCP tool |
| GET | `/q/health/live` | Liveness probe |
| GET | `/q/health/ready` | Readiness probe |
| GET | `/q/openapi` | OpenAPI 3.0 specification |

## Verification

After installation, verify the deployment:

```bash
# Check operator pod
oc get pods -n openshift-integration -l app.kubernetes.io/name=openshift-integration-operator

# Verify CRD registration
oc get crd integrationflows.platform.io

# Check IntegrationFlow resources
oc get integrationflows -n openshift-integration

# Verify console plugin
oc get consoleplugin integration-console-plugin
oc get pods -n openshift-integration -l app=integration-console-plugin

# Check operator health
oc exec -n openshift-integration deployment/openshift-integration-operator -- curl -s localhost:8080/q/health
```

## Troubleshooting

### Operator pod in CrashLoopBackOff

Check logs and ensure the CRD is registered:

```bash
oc logs -n openshift-integration deployment/openshift-integration-operator
oc get crd integrationflows.platform.io
```

If the CRD is missing, apply it manually from the operator's generated output:

```bash
oc apply -f target/kubernetes/integrationflows.platform.io-v1.yml
```

### Console plugin shows "Failed to load scripts"

1. Verify the plugin pod is running and serving over HTTPS:
```bash
oc get pods -n openshift-integration -l app=integration-console-plugin
oc exec -n openshift-integration deployment/integration-console-plugin -- \
  curl -sk https://localhost:8443/plugin-manifest.json
```

2. Check plugin is enabled in the console operator:
```bash
oc get console.operator.openshift.io cluster -o jsonpath='{.spec.plugins}'
```

3. Enable it if missing:
```bash
oc patch console.operator.openshift.io cluster --type=json \
  -p='[{"op":"add","path":"/spec/plugins/-","value":"integration-console-plugin"}]'
```

### Workers not scaling

Verify the HPA is configured and metrics are available:

```bash
oc get hpa -n openshift-integration
oc describe hpa openshift-integration-operator-workers -n openshift-integration
```

## Links

- **GitHub**: [maximilianoPizarro/openshift-integration-operator](https://github.com/maximilianoPizarro/openshift-integration-operator)
- **Documentation**: [GitHub Pages](https://maximilianopizarro.github.io/openshift-integration-operator/)
- **Artifact Hub**: [openshift-integration-operator](https://artifacthub.io/packages/search?repo=openshift-integration-operator)
- **Container Images**: [quay.io/maximilianopizarro](https://quay.io/organization/maximilianopizarro)

## License

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

---

Built by [maximilianoPizarro](https://github.com/maximilianoPizarro) · [GitHub Pages](https://maximilianopizarro.github.io/openshift-integration-operator/)
