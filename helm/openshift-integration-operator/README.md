# OpenShift Integration Operator

Real-Time Integration & Orchestration Platform for OpenShift.

## Features

- **Dual Engine**: Apache Camel routes + CNCF SonataFlow workflows
- **Visual Designer**: Kaoto canvas embedded in OpenShift Console
- **GitOps Native**: Tekton builds + ArgoCD deploys
- **MCP/AI Ready**: Model Context Protocol bridge for AI tool calling
- **Observable**: Native OpenTelemetry with real-time node telemetry
- **Auto-scaling**: HPA-driven worker pod scaling

## Installation

```bash
helm repo add integration-platform https://maximilianopizarro.github.io/openshift-integration-operator/
helm install integration-operator integration-platform/openshift-integration-operator \
  --namespace openshift-integration --create-namespace
```

## Configuration

See [values.yaml](values.yaml) for all configurable parameters.

## License

Apache License 2.0
