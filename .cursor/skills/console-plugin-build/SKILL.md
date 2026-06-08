---
name: console-plugin-build
description: Build and deploy the OpenShift Console dynamic plugin container image
---

# Console Plugin Build

## Cluster deploy (recommended)

**Do not** binary-build the plugin on the dev cluster unless testing plugin changes locally. Use the image published by CI:

```yaml
# helm/openshift-integration-operator values (or --set)
consolePlugin:
  enabled: true
  image:
    repository: quay.io/maximilianopizarro/integration-console-plugin
    tag: latest   # CI updates on every main push; v0.4.0 may lag
```

Verify on cluster:
```bash
oc get deploy integration-console-plugin -n openshift-integration \
  -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
oc rollout status deployment/integration-console-plugin -n openshift-integration
oc get consoleplugin integration-console-plugin
```

CI workflow: `.github/workflows/build-push-quay.yml` → job `build-console-plugin`.

## Local webpack build

```bash
cd console-plugin
npm install
npm run build
# Output: console-plugin/dist/
```

## Container image (production / CI)

Multi-stage Dockerfile at `console-plugin/Dockerfile`:

1. **Build stage** — UBI9 Node.js 22, `npm ci`, webpack production build
2. **Go build** — UBI9 go-toolset, compiles `serve.go` static HTTPS server
3. **Runtime** — UBI9 micro with `serve` binary, serves `dist/` on port **9443**

```bash
docker build -f console-plugin/Dockerfile \
  -t quay.io/maximilianopizarro/integration-console-plugin:latest \
  console-plugin
docker push quay.io/maximilianopizarro/integration-console-plugin:latest
```

TLS cert is mounted at `/var/serving-cert` (OpenShift serving-cert annotation on Service).

## OpenShift binary build (local plugin dev only)

Used by `scripts/deploy-cluster.sh` — skip when using Quay `latest`:

```bash
oc apply -f k8s/console-plugin-buildconfig.yaml
oc start-build integration-console-plugin --from-dir=console-plugin --follow -n openshift-integration
```

## Helm deployment

Chart deploys a **Deployment** + Service. ConsolePlugin CR points to Service port 9443:

```yaml
consolePlugin:
  enabled: true
  image:
    repository: quay.io/maximilianopizarro/integration-console-plugin
    tag: latest
```

In-pod check:
```bash
oc exec deploy/integration-console-plugin -n openshift-integration -- \
  curl -sk https://localhost:9443/plugin-manifest.json
```

## Proxy configuration

- Plugin name: `integration-console-plugin`
- Backend proxy alias: `backend`
- Frontend (`console-plugin/src/constants.ts`):

```
PROXY_BASE = /api/proxy/plugin/integration-console-plugin/backend
```

Used for telemetry SSE, lifecycle API, flow logs, and template catalog (`docs/flow-catalog.json` via docs base URL).

Operator backend must be **HTTPS 8443** (not plain HTTP 8080).

## Template catalog

- Source: `docs/flow-catalog.json` (extracted/maintained via `scripts/extract-flow-catalog.js`)
- UI: `console-plugin/src/components/modals/TemplateCatalogModal.tsx`
- Validate: `node scripts/validate-ready-flows.js` (not yet in CI — run locally before push)
