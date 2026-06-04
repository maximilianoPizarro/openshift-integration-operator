<p align="center">
  <img src="docs/images/logo.svg" alt="OpenShift Integration Operator" width="120" height="120">
</p>

<h1 align="center">OpenShift Integration Operator</h1>

<p align="center">
  <strong>Real-Time Integration & Orchestration Platform for OpenShift</strong>
</p>

<p align="center">
  Open-source alternative to n8n, powered by Apache Camel + CNCF SonataFlow, with visual Kaoto designer, MCP/AI integration, and native Kubernetes orchestration.
</p>

<p align="center">
  <a href="https://www.apache.org/licenses/LICENSE-2.0"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License"></a>
  <a href="https://github.com/maximilianoPizarro/openshift-integration-operator/actions"><img src="https://github.com/maximilianoPizarro/openshift-integration-operator/actions/workflows/build-push-quay.yml/badge.svg" alt="GitHub Actions"></a>
  <a href="https://quay.io/repository/maximilianopizarro/openshift-integration-operator"><img src="https://img.shields.io/badge/Quay.io-operator-EE3300?logo=redhat" alt="Quay.io"></a>
</p>

<p align="center">
  <a href="https://maximilianopizarro.github.io/openshift-integration-operator/">Documentation</a> ·
  <a href="https://artifacthub.io/packages/search?repo=openshift-integration-operator">Artifact Hub</a> ·
  <a href="docs/architecture.html">Architecture</a> ·
  <a href="docs/quickstart.html">Quick Start</a>
</p>

---

## Features

- **Dual Engine** — Run Apache Camel routes or CNCF SonataFlow workflows from a single `IntegrationFlow` CR
- **Visual Designer** — Embedded Kaoto canvas in the OpenShift Console for drag-and-drop flow design
- **GitOps Native** — Tekton builds container images; ArgoCD syncs worker deployments from Git
- **MCP/AI Ready** — Model Context Protocol bridge for discovering and invoking AI tools in flows
- **Observable** — OpenTelemetry instrumentation with real-time SSE telemetry for canvas node coloring
- **Auto-scaling Workers** — HPA-driven worker pods scale on CPU and memory utilization
- **Multi-cluster** — Target multiple clusters from a single IntegrationFlow spec via GitOps
- **Apache 2.0 License** — Free to use, modify, and distribute

## Architecture Overview

```mermaid
flowchart TB
    subgraph Console["OpenShift Console"]
        Plugin["Console Plugin"]
        Kaoto["Kaoto Designer"]
        Telemetry["Telemetry Overlay"]
    end

    subgraph Operator["Integration Operator"]
        Reconciler["IntegrationFlow Reconciler"]
        Scaffold["Scaffolding Service"]
        GitOps["GitOps Service"]
        MCP["MCP Bridge API"]
        SSE["Telemetry SSE API"]
    end

    subgraph GitOpsLayer["GitOps Layer"]
        Gitea["Gitea"]
        Tekton["Tekton Pipelines"]
        ArgoCD["ArgoCD"]
    end

    subgraph Runtime["Worker Runtime"]
        Workers["Worker Pods"]
        OTel["OpenTelemetry"]
        HPA["HPA Autoscaler"]
    end

    User((User)) --> Plugin
    Plugin --> Kaoto
    Plugin --> Telemetry
    Telemetry --> SSE

    User -->|IntegrationFlow CR| Reconciler
    Reconciler --> Scaffold
    Scaffold --> GitOps
    GitOps --> Gitea
    GitOps --> Tekton
    Tekton -->|Build image| ArgoCD
    ArgoCD --> Workers
    HPA --> Workers
    Workers --> OTel
    OTel --> SSE

    Kaoto -->|MCP tool calls| MCP
    MCP --> Workers
```

See the full [Architecture Documentation](docs/architecture.html) for CRD details, reconciliation steps, and telemetry pipeline.

## Quick Start

### Prerequisites

- OpenShift 4.14+
- Helm 3
- `oc` CLI
- Gitea, ArgoCD, and Tekton Pipelines installed on the cluster

### Install with Helm

```bash
helm repo add integration-platform \
  https://maximilianopizarro.github.io/openshift-integration-operator/

helm repo update

helm install integration-operator \
  integration-platform/openshift-integration-operator \
  --namespace openshift-integration \
  --create-namespace
```

### Create an IntegrationFlow

```bash
oc apply -f - <<'EOF'
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
                simple: "Hello from IntegrationFlow"
            - log:
                message: "${body}"
EOF
```

See the [Quick Start Guide](docs/quickstart.html) for SONATAFLOW examples and console plugin access.

## Project Structure

```
openshift-integration-operator/
├── src/main/java/io/platform/
│   ├── api/v1alpha1/          # IntegrationFlow CRD types
│   ├── operator/              # Reconciler controller
│   ├── service/               # Scaffolding & GitOps services
│   ├── telemetry/             # SSE telemetry API
│   └── mcp/                   # MCP bridge API
├── console-plugin/            # OpenShift Console dynamic plugin
│   ├── src/components/        # React UI (Kaoto, telemetry overlay)
│   └── console-extensions.json
├── helm/openshift-integration-operator/
│   ├── templates/             # Operator, HPA, ConsolePlugin manifests
│   ├── values.yaml
│   └── Chart.yaml
├── docs/                        # GitHub Pages site
│   ├── index.html
│   ├── architecture.html
│   ├── quickstart.html
│   └── artifacthub-repo.yml
├── .github/workflows/
│   ├── build-push-quay.yml    # CI: build, test, push to Quay.io
│   └── deploy-openshift.yml   # CD: Helm deploy to OpenShift
└── pom.xml                      # Quarkus + Operator SDK
```

## Development Setup

### Requirements

- JDK 17
- Maven 3.9+
- Node.js 18+ (for console plugin)
- Docker (for container builds)

### Run the Operator Locally

```bash
# Start in Quarkus dev mode (hot reload)
mvn quarkus:dev
```

The operator exposes REST endpoints at `http://localhost:8080`:

| Endpoint | Description |
|----------|-------------|
| `GET /api/telemetry/stream/{flowId}` | SSE stream of node telemetry |
| `GET /api/telemetry/snapshot/{flowId}` | Point-in-time node status |
| `GET /api/mcp/tools?serverUrl=...` | List MCP tools |
| `POST /api/mcp/tools/{name}/call` | Invoke an MCP tool |

### Build Console Plugin

```bash
cd console-plugin
npm install
npm run build
```

### Build Container Image

```bash
mvn package -DskipTests
docker build -f src/main/docker/Dockerfile.jvm \
  -t quay.io/maximilianopizarro/openshift-integration-operator:dev .
```

## CI/CD Overview

| Workflow | Trigger | Actions |
|----------|---------|---------|
| **Build and push to Quay.io** | Push to `main`, manual dispatch | Maven build & test, push operator image to Quay.io, package Helm chart to `docs/` |
| **Deploy to OpenShift** | After successful build, manual dispatch | `oc login`, Helm upgrade, verify rollout, create sample IntegrationFlow |

Images are published to:

```
quay.io/maximilianopizarro/openshift-integration-operator:latest
quay.io/maximilianopizarro/integration-console-plugin:latest
```

Helm charts are served from GitHub Pages:

```
https://maximilianopizarro.github.io/openshift-integration-operator/
```

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Make your changes and add tests where applicable
4. Run `mvn test` to verify
5. Submit a pull request with a clear description of the change

Please follow existing code conventions and keep changes focused.

## License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
