---
name: deploy-to-openshift
description: Deploy the operator to an OpenShift cluster using Helm
---

# Deploying to OpenShift

## Prerequisites
- `oc` CLI installed and logged in
- Helm 3 installed
- Access to Quay.io registry (for image pull)

## Steps

1. **Build the operator image**
```bash
mvn -B package -DskipTests
docker build -f src/main/docker/Dockerfile.jvm -t quay.io/maximilianopizarro/openshift-integration-operator:latest .
docker push quay.io/maximilianopizarro/openshift-integration-operator:latest
```

2. **Login to OpenShift**
```bash
oc login --token=<token> --server=<server-url>
```

3. **Install via Helm**
```bash
helm upgrade --install openshift-integration-operator \
  helm/openshift-integration-operator \
  --namespace openshift-integration \
  --create-namespace \
  --set operator.image.tag=latest
```

4. **Verify**
```bash
oc get pods -n openshift-integration
oc get crd integrationflows.platform.io
oc logs -f deployment/openshift-integration-operator -n openshift-integration
```

5. **Create a test flow**
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
  targetClusters:
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
```

6. **Check status**
```bash
oc get integrationflow test-camel-flow -o yaml
```
