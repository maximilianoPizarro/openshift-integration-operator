---
name: deploy-to-openshift
description: Deploy the operator to an OpenShift cluster using Helm
---

# Deploying to OpenShift

## Prerequisites
- `oc` CLI installed and logged in
- Helm 3 installed
- OpenShift cluster with ImageStreams / BuildConfigs (for cluster-local builds)

## Option A: Cluster-local deploy (`scripts/deploy-cluster.sh`)

Use this for development clusters — builds operator and console plugin via OpenShift binary builds and internal registry ImageStreams.

```bash
# From repo root; requires mvn package first for CRD
mvn -B package -DskipTests
./scripts/deploy-cluster.sh
```

The script:
1. Applies CRD from `target/kubernetes/integrationflows.platform.io-v1.yml`
2. Binary-builds `openshift-integration-operator` ImageStream
3. Binary-builds `integration-console-plugin` ImageStream (from `console-plugin/`)
4. Helm upgrade with internal registry image refs
5. Waits for operator and console plugin rollouts

Verify:
```bash
oc get pods -n openshift-integration
oc get consoleplugin integration-console-plugin
```

## Option B: Quay.io images (production / CI)

1. **Build and push operator image**
```bash
mvn -B package -DskipTests
docker build -f src/main/docker/Dockerfile.jvm -t quay.io/maximilianopizarro/openshift-integration-operator:latest .
docker push quay.io/maximilianopizarro/openshift-integration-operator:latest
```

2. **Build and push console plugin image**
```bash
docker build -f console-plugin/Dockerfile -t quay.io/maximilianopizarro/integration-console-plugin:latest console-plugin
docker push quay.io/maximilianopizarro/integration-console-plugin:latest
```

3. **Install via Helm**
```bash
helm upgrade --install openshift-integration-operator \
  helm/openshift-integration-operator \
  --namespace openshift-integration \
  --create-namespace \
  --set operator.image.tag=v0.3.0 \
  --set consolePlugin.image.tag=v0.3.0
```

## Secrets management

Do **not** commit passwords or tokens in `values.yaml`. Options:

| Provider | Helm |
|----------|------|
| Dev (`values`) | `--set gitea.password=...` at install time |
| External Secrets | `secrets.provider=external-secrets` + `secrets.externalSecrets.enabled=true` |
| Sealed Secrets | Encrypt with `kubeseal`, apply alongside Helm |

```yaml
secrets:
  provider: external-secrets
  externalSecrets:
    enabled: true
    secretStoreRef: cluster-secret-store
```

Git credentials are mounted from Secret refs when External Secrets is enabled (`templates/external-secret.yaml`).

## Multi-namespace

```yaml
operator:
  watchedNamespaces: []   # cluster-wide (default)
namespace: openshift-integration
sonataflow:
  namespace: kogito-bpm
```

Per-CR worker resources are created in the IntegrationFlow namespace. Multi-cluster uses Argo CD ApplicationSets with `spec.targeting`.

## Ephemeral smoke test

After deploy, validate Quick Try mode:

```bash
oc apply -f k8s/examples/09-ephemeral-demo.yaml

# Wait for Running phase
oc get integrationflow ephemeral-camel-demo -n openshift-integration -w

# Confirm ephemeral worker deployment
oc get deploy -n openshift-integration -l platform.io/ephemeral=true

# Check operator logs for deploy confirmation
oc logs deploy/openshift-integration-operator -n openshift-integration --tail=20 | grep -i ephemeral
```

Expected: `status.phase=Running`, `status.ephemeralWorkerRef` set, worker pod logging timer messages.

## Console plugin proxy

The plugin uses proxy alias `backend` in the ConsolePlugin CR. Frontend requests go through:

```
/api/proxy/plugin/integration-console-plugin/backend/...
```

Plugin name must match `integration-console-plugin` (see `console-plugin/src/constants.ts`).

The proxy target is the operator Service on **HTTPS port 8443** (OpenShift serving cert). Plain HTTP on 8080 causes `502` / `tls: first record does not look like a TLS handshake` in console logs.

## GitOps test flow (optional)

```bash
cat <<EOF | oc apply -n openshift-integration -f -
apiVersion: platform.io/v1alpha1
kind: IntegrationFlow
metadata:
  name: test-camel-flow
spec:
  engine: CAMEL
  gitRepository: https://gitea.example.com/demo/test-worker.git
  branch: main
  targeting:
    strategy: explicit
    clusters:
      - local
  kaotoDesign: |
    - route:
        from:
          uri: timer:tick
          parameters:
            period: 5000
          steps:
            - log:
                message: "Hello from test flow"
EOF

oc get integrationflow test-camel-flow -o yaml
```

Placeholder git hosts (`gitea.example.com`, etc.) are rewritten to operator-configured URLs via `GitUrlResolver`.
