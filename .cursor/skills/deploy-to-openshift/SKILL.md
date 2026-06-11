---
name: deploy-to-openshift
description: Deploy the operator to an OpenShift cluster using Quay.io and Operator SDK (OLM)
---

# Deploying to OpenShift

**Registry policy:** Quay.io (`quay.io/maximilianopizarro/*`) is the only trusted registry for operator, console plugin, workers, and OLM bundle. Do not use the OpenShift internal registry or `oc start-build` for operator images.

## Prerequisites
- `oc` CLI logged in
- `operator-sdk` v1.40+
- `podman` (for local publish) or GitHub Actions CI
- Quay credentials: `podman login quay.io` or CI secrets

## Recommended (engo / v0.5.0): Quay + Operator SDK

### 1. Publish images to Quay

**Option A — CI (preferred after merge to `main`):**

```bash
gh workflow run build-push-quay.yml -f image_tag=v0.5.0
gh run watch   # wait for operator, console-plugin, bundle jobs
```

**Option B — local publish:**

```bash
podman login quay.io
VERSION_TAG=v0.5.0 ./scripts/publish-quay.sh
```

**Optional — prune stale Quay tags** (keeps `latest` and `v0.5.0`):

```bash
QUAY_API_TOKEN=<robot-token> KEEP_TAGS=latest,v0.5.0 ./scripts/prune-quay-tags.sh
```

### 2. Install via OLM bundle (Operator SDK)

```bash
mvn -B clean package -DskipTests
operator-sdk bundle validate ./bundle

# Uninstall previous version
operator-sdk cleanup openshift-integration-operator -n openshift-integration

operator-sdk run bundle quay.io/maximilianopizarro/openshift-integration-operator-bundle:v0.5.0 \
  --namespace openshift-integration \
  --install-mode AllNamespaces \
  --timeout 10m

oc get csv -n openshift-integration
oc get pods -n openshift-integration
oc get consoleplugin integration-console-plugin
```

### 3. Validate ephemeral delete (v0.5.0)

```bash
oc apply -f k8s/examples/09-ephemeral-demo.yaml
oc get integrationflow ephemeral-camel-demo -o jsonpath='{.metadata.finalizers}{"\n"}'
oc get deploy -l platform.io/flow-name=ephemeral-camel-demo -o jsonpath='{.items[0].metadata.ownerReferences[0].kind}{"\n"}'
oc delete integrationflow ephemeral-camel-demo -n openshift-integration
oc get deploy -l platform.io/ephemeral=true -n openshift-integration   # expect empty
```

## Alternative: Helm (production / chart consumers)

Use published Quay images only — no internal registry:

```bash
helm upgrade --install openshift-integration-operator \
  helm/openshift-integration-operator \
  --namespace openshift-integration \
  --create-namespace \
  --set operator.image.repository=quay.io/maximilianopizarro/openshift-integration-operator \
  --set operator.image.tag=v0.5.0 \
  --set consolePlugin.image.repository=quay.io/maximilianopizarro/integration-console-plugin \
  --set consolePlugin.image.tag=v0.5.0 \
  --set gitea.password='your-gitea-password' \
  --set tekton.approvalEnabled=false
```

## Helm values (dev cluster)

| Key | Dev value | Notes |
|-----|-----------|-------|
| `operator.image.tag` | `v0.5.0` | Quay only |
| `consolePlugin.image.tag` | `v0.5.0` | Quay only |
| `gitea.password` | workshop password | Required for Gitea push |
| `tekton.approvalEnabled` | `false` | Skip ApprovalTask |
| `ephemeral.preferFullWorker` | `false` | Tier-based worker selection |
| `operator.watchedNamespaces` | `[]` | Cluster-wide watch |

## Multi-namespace

```yaml
operator:
  watchedNamespaces: []   # cluster-wide (default)
namespace: openshift-integration
sonataflow:
  namespace: kogito-bpm
```

## Ephemeral smoke test

```bash
oc apply -f k8s/examples/09-ephemeral-demo.yaml
oc get integrationflow ephemeral-camel-demo -n openshift-integration -w
oc get deploy -l platform.io/ephemeral=true -n openshift-integration
```

See skill `ephemeral-mode` for TTL, promote, and worker tiers.

## Console plugin proxy

- Plugin name: `integration-console-plugin`
- Proxy path: `/api/proxy/plugin/integration-console-plugin/backend/...`
- Backend: operator Service **HTTPS port 8443**

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `operator-sdk run bundle` ImagePullBackOff | Tag not on Quay | Run `publish-quay.sh` or CI workflow |
| Stale operator code | Old Quay tag cached | Bump tag to `v0.5.0`, prune old tags |
| Ephemeral deploys orphaned | Pre-0.5.0 bug | Upgrade to v0.5.0+ with ownerReferences fix |
| PipelineRun `Source option 5` | Stale scaffold in Gitea | Redeploy operator; recreate flow |
| Gitea HTTP 500 | Concurrent reconciles | Apply flows sequentially |

Placeholder git hosts (`gitea.example.com`) are rewritten via `GitUrlResolver`.
