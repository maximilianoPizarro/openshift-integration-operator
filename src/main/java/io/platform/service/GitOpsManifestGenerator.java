package io.platform.service;

import io.platform.api.v1alpha1.IntegrationType;

/**
 * Generates Kubernetes manifests pushed to Git for ArgoCD to sync from {@code base/}.
 */
public final class GitOpsManifestGenerator {

    private GitOpsManifestGenerator() {
    }

    public static String hpaName(String flowName) {
        return "iflow-" + flowName + "-hpa";
    }

    public static String kustomization(String flowName, IntegrationType type) {
        String resourcesBlock = switch (type) {
            case CAMEL_KAMELET -> "  - kamelet.yaml\n";
            case CAMEL_PIPE -> "  - pipe.yaml\n";
            case SONATAFLOW -> "  - sonataflow.yaml\n";
            default -> "  - deployment.yaml\n  - service.yaml\n  - hpa.yaml\n";
        };
        return """
                apiVersion: kustomize.config.k8s.io/v1beta1
                kind: Kustomization
                resources:
                %slabels:
                  - pairs:
                      app.kubernetes.io/part-of: integration-platform
                      kaoto.io/integration: "%s"
                """.formatted(resourcesBlock, flowName);
    }

    public static String deployment(String flowName, String image) {
        String appLabel = deploymentName(flowName);
        return """
                apiVersion: apps/v1
                kind: Deployment
                metadata:
                  name: %s
                  labels:
                    app.kubernetes.io/part-of: integration-platform
                    kaoto.io/integration: "%s"
                spec:
                  replicas: 1
                  selector:
                    matchLabels:
                      app: %s
                  template:
                    metadata:
                      labels:
                        app: %s
                        kaoto.io/integration: "%s"
                    spec:
                      containers:
                        - name: worker
                          image: %s
                          imagePullPolicy: Always
                          ports:
                            - containerPort: 8080
                              name: http
                """.formatted(appLabel, flowName, appLabel, appLabel, flowName, image);
    }

    public static String service(String flowName) {
        String appLabel = deploymentName(flowName);
        return """
                apiVersion: v1
                kind: Service
                metadata:
                  name: %s
                  labels:
                    app.kubernetes.io/part-of: integration-platform
                    kaoto.io/integration: "%s"
                spec:
                  selector:
                    app: %s
                  ports:
                    - name: http
                      port: 8080
                      targetPort: 8080
                """.formatted(appLabel, flowName, appLabel);
    }

    public static String sonataFlowCr(String flowName, String sonataFlowNamespace, String workflowYaml) {
        if (workflowYaml == null || workflowYaml.isBlank()) {
            return "";
        }
        String indentedFlow = workflowYaml.lines()
                .map(line -> line.isBlank() ? "" : "    " + line)
                .reduce((a, b) -> a + "\n" + b)
                .orElse("");
        return """
                apiVersion: sonataflow.org/v1alpha08
                kind: SonataFlow
                metadata:
                  name: iflow-%s
                  namespace: %s
                  labels:
                    app.kubernetes.io/part-of: integration-platform
                    platform.io/flow-name: "%s"
                spec:
                  flow:
                %s
                """.formatted(flowName, sonataFlowNamespace, flowName, indentedFlow);
    }

    public static String camelCrManifest(String workflowYaml) {
        return workflowYaml;
    }

    public static String workerImage(String registryHost, String namespace, String flowName, String imageTag) {
        return "%s/%s/%s:%s".formatted(registryHost, namespace, flowName, imageTag);
    }

    public static String deploymentName(String flowName) {
        return "iflow-" + flowName;
    }

    public static String ephemeralDeploymentName(String flowName) {
        return "iflow-" + flowName + "-worker";
    }

    public static String hpa(String flowName, int minReplicas, int maxReplicas,
                             int targetCpuUtilization, int targetMemoryUtilization) {
        String deploymentName = deploymentName(flowName);
        return """
                apiVersion: autoscaling/v2
                kind: HorizontalPodAutoscaler
                metadata:
                  name: %s
                  labels:
                    app.kubernetes.io/part-of: integration-platform
                    platform.io/flow-name: "%s"
                    platform.io/component: worker-hpa
                spec:
                  scaleTargetRef:
                    apiVersion: apps/v1
                    kind: Deployment
                    name: %s
                  minReplicas: %d
                  maxReplicas: %d
                  metrics:
                    - type: Resource
                      resource:
                        name: cpu
                        target:
                          type: Utilization
                          averageUtilization: %d
                    - type: Resource
                      resource:
                        name: memory
                        target:
                          type: Utilization
                          averageUtilization: %d
                """.formatted(hpaName(flowName), flowName, deploymentName,
                minReplicas, maxReplicas, targetCpuUtilization, targetMemoryUtilization);
    }
}
