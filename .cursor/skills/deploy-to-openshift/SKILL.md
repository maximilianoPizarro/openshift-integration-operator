---
name: deploy-to-openshift
description: Deploy the operator to an OpenShift cluster using Helm
---

# Deploying to OpenShift

## Prerequisites
- `oc` CLI installed and logged in
- Helm 3 installed
- OpenShift cluster with ImageStreams / BuildConfigs (operator binary build)
- Gitea reachable from cluster (GitOps examples)

## Recommended: Dev cluster update (operator local + plugin Quay)

Use this workflow for the Red Hat workshops / dev cluster. Builds the **operator** via OpenShift binary build; uses **Quay** for the console plugin (CI-built, do not `oc start-build` the plugin locally).

```bash
# From repo root
mvn -B clean package -DskipTests

oc apply -f target/kubernetes/integrationflows.platform.io-v1.yml

oc start-build openshift-integration-operator --from-dir=. --follow -n openshift-integration
```

Capture the pushed digest from build output (e.g. `sha256:8d2d7881...`).

```bash
helm upgrade --install openshift-integration-operator \
  helm/openshift-integration-operator \
  --namespace openshift-integration \
  --set operator.image.repository="image-registry.openshift-image-registry.svc:5000/openshift-integration/openshift-integration-operator" \
  --set operator.image.tag=latest \
  --set consolePlugin.image.repository="quay.io/maximilianopizarro/integration-console-plugin" \
  --set consolePlugin.image.tag=latest \
  --set gitea.password='Welcome123!' \
  --set tekton.approvalEnabled=false
```

**Pin operator image by digest** (required — `:latest` is not repulled by kubelet on existing nodes):

```bash
oc set image deployment/openshift-integration-operator operator=\
  image-registry.openshift-image-registry.svc:5000/openshift-integration/openshift-integration-operator@sha256:<digest> \
  -n openshift-integration

oc rollout status deployment/openshift-integration-operator -n openshift-integration --timeout=180s
oc rollout status deployment/integration-console-plugin -n openshift-integration --timeout=120s
```

Verify:
```bash
oc get pods -n openshift-integration
oc get deploy openshift-integration-operator -n openshift-integration \
  -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
oc get consoleplugin integration-console-plugin
```

## Option A: `scripts/deploy-cluster.sh` (full local build)

Builds **both** operator and console plugin via OpenShift binary builds. Prefer the recommended workflow above for day-to-day dev (faster plugin rollout from Quay CI).

```bash
mvn -B package -DskipTests
./scripts/deploy-cluster.sh
```

Still pin operator digest after the script if pods show stale behavior.

## Option B: Quay.io images (production / CI)

Triggered by GitHub Actions on push to `main` (`.github/workflows/build-push-quay.yml`).

```bash
helm upgrade --install openshift-integration-operator \
  helm/openshift-integration-operator \
  --namespace openshift-integration \
  --create-namespace \
  --set operator.image.repository=quay.io/maximilianopizarro/openshift-integration-operator \
  --set operator.image.tag=latest \
  --set consolePlugin.image.repository=quay.io/maximilianopizarro/integration-console-plugin \
  --set consolePlugin.image.tag=latest \
  --set gitea.password='...' \
  --set tekton.approvalEnabled=false
```

On version tag push (`v*`), CI also publishes `:v0.4.0` and native images.

## Camel K bootstrap (Pipe / Kamelet examples)

Required once per namespace for `etl-pipe` and `s3-to-db-kamelet`:

```bash
oc apply -f k8s/bootstrap/camel-k-platform.yaml

# Registry push secret for Camel K kit builds (401 Unauthorized without this)
TOKEN=$(oc whoami -t)
oc create secret docker-registry camel-k-registry-auth \
  -n openshift-integration \
  --docker-server=image-registry.openshift-image-registry.svc:5000 \
  --docker-username=$(oc whoami) \
  --docker-password="$TOKEN" \
  --dry-run=client -o yaml | oc apply -f -

oc patch integrationplatform camel-k -n openshift-integration --type=merge \
  -p '{"spec":{"build":{"registry":{"secret":"camel-k-registry-auth"}}}}'
```

Verify: `oc get integrationplatform camel-k -n openshift-integration` → `Ready`.

## GitOps examples

Eight catalog flows in `k8s/examples/01`–`08`. See skill `gitops-examples` for apply order, pipeline verification, and troubleshooting.

Quick apply (sequential, ~12s gap avoids Gitea HTTP 500 under concurrent scaffold):

```bash
for yaml in 01-rest-to-kafka 02-order-routing-cbr 03-parallel-enrichment \
  04-error-handling-dlq 05-s3-to-db-kamelet 06-etl-pipe \
  07-file-processor-workflow 08-saga-workflow; do
  oc apply -f "k8s/examples/${yaml}.yaml"
  sleep 12
done
```

After Tekton builds succeed, restart deployments stuck in `ImagePullBackOff`:

```bash
for d in iflow-rest-to-kafka iflow-error-handling-dlq iflow-order-routing-cbr iflow-parallel-enrichment; do
  oc rollout restart deployment/$d -n openshift-integration
done
```

Refresh Argo CD health if flows show `PartiallyHealthy` while pods are fine:

```bash
for app in rest-to-kafka-in-cluster error-handling-dlq-in-cluster \
  order-routing-cbr-in-cluster parallel-enrichment-in-cluster; do
  oc annotate application $app -n openshift-gitops argocd.argoproj.io/refresh=hard --overwrite
done
```

## Secrets management

Do **not** commit passwords in `values.yaml`.

| Provider | Helm |
|----------|------|
| Dev | `--set gitea.password=...` at install time |
| External Secrets | `secrets.provider=external-secrets` |
| Sealed Secrets | Encrypt with `kubeseal` |

Tekton git clone uses `integration-git-basic-auth` (Helm template includes `.git-credentials` + `.gitconfig`).

## Helm values (dev cluster)

| Key | Dev value | Notes |
|-----|-----------|-------|
| `gitea.password` | workshop password | Required for Gitea push |
| `tekton.approvalEnabled` | `false` | Skip ApprovalTask in pipeline |
| `consolePlugin.image.tag` | `latest` | From Quay CI; `v0.4.0` may be stale |
| `ephemeral.preferFullWorker` | `false` | Tier-based worker selection |
| `sonataflow.namespace` | `kogito-bpm` | SonataFlow CR target |

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
- Backend: operator Service **HTTPS port 8443** (serving cert). HTTP 8080 → `502` / TLS handshake errors.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Operator runs old code after binary build | `:latest` not repulled | `oc set image ...@sha256:<digest>` |
| PipelineRun `Source option 5` / Java 5 | Stale scaffold in Gitea | Redeploy operator with scaffold fix; recreate flow |
| `ImagePullBackOff` on `iflow-*` | Deploy before image built | Wait for PipelineRun; `oc rollout restart deployment/...` |
| `etl-pipe` Waiting For Platform | No IntegrationPlatform | Apply `k8s/bootstrap/camel-k-platform.yaml` |
| Camel K `401 Unauthorized` on kit push | Missing registry secret | Create `camel-k-registry-auth` (see above) |
| Gitea HTTP 500 on scaffold | Concurrent reconciles | Apply flows sequentially; operator retries writes |
| Argo CD `Degraded` but pod Running | Stale health cache | Hard refresh Application annotations |

Placeholder git hosts (`gitea.example.com`) are rewritten via `GitUrlResolver` / `ScaffoldSourceResolver`.
