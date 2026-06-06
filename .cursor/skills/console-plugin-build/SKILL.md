---
name: console-plugin-build
description: Build and deploy the OpenShift Console dynamic plugin container image
---

# Console Plugin Build

## Local webpack build

```bash
cd console-plugin
npm install
npm run build
# Output: console-plugin/dist/
```

## Container image (production)

Multi-stage Dockerfile at `console-plugin/Dockerfile`:

1. **Build stage** — UBI9 Node.js 22, `npm ci`, webpack production build
2. **Go build** — UBI9 go-toolset, compiles `serve.go` static HTTPS server
3. **Runtime** — UBI9 micro with `serve` binary, serves `dist/` on port **9443**

Helm label: `app.openshift.io/runtime: golang`.

```bash
docker build -f console-plugin/Dockerfile \
  -t quay.io/maximilianopizarro/integration-console-plugin:latest \
  console-plugin
```

TLS cert is mounted at `/var/serving-cert` (OpenShift serving-cert annotation on Service).

## OpenShift binary build

Used by `scripts/deploy-cluster.sh`:

```bash
oc apply -f k8s/console-plugin-buildconfig.yaml
oc start-build integration-console-plugin --from-dir=console-plugin --follow -n openshift-integration
```

## Helm deployment

Chart deploys a **Deployment** + Service (not ConfigMap). ConsolePlugin CR points to Service port 9443:

```yaml
consolePlugin:
  enabled: true
  image:
    repository: quay.io/maximilianopizarro/integration-console-plugin
    tag: v0.2.0
```

Verify:
```bash
oc get deploy integration-console-plugin -n openshift-integration
oc exec deploy/integration-console-plugin -n openshift-integration -- \
  curl -sk https://localhost:9443/plugin-manifest.json
oc get consoleplugin integration-console-plugin
```

## Proxy configuration

Plugin name: `integration-console-plugin`. Backend proxy alias: `backend`.

Frontend constant (`console-plugin/src/constants.ts`):
```
PROXY_BASE = /api/proxy/plugin/integration-console-plugin/backend
```

Used for telemetry SSE, lifecycle API, and flow logs tab.
