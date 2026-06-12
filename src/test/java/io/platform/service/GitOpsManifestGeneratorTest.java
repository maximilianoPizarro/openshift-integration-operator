package io.platform.service;

import io.platform.api.v1alpha1.IntegrationType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class GitOpsManifestGeneratorTest {

    @Test
    void camelRouteKustomizationIncludesDeploymentServiceAndHpa() {
        String kustomize = GitOpsManifestGenerator.kustomization("rest-to-kafka", IntegrationType.CAMEL_ROUTE);
        assertTrue(kustomize.contains("deployment.yaml"));
        assertTrue(kustomize.contains("service.yaml"));
        assertTrue(kustomize.contains("hpa.yaml"));
    }

    @Test
    void hpaTargetsFlowDeployment() {
        String hpa = GitOpsManifestGenerator.hpa("rest-to-kafka", 1, 10, 70, 80);
        assertTrue(hpa.contains("name: iflow-rest-to-kafka-hpa"));
        assertTrue(hpa.contains("name: iflow-rest-to-kafka"));
        assertTrue(hpa.contains("averageUtilization: 70"));
    }

    @Test
    void deploymentReferencesWorkerImage() {
        String deployment = GitOpsManifestGenerator.deployment("rest-to-kafka",
                "image-registry.openshift-image-registry.svc:5000/openshift-integration/rest-to-kafka:latest");
        assertTrue(deployment.contains("name: iflow-rest-to-kafka"));
        assertTrue(deployment.contains("image: image-registry.openshift-image-registry.svc:5000/openshift-integration/rest-to-kafka:latest"));
    }

    @Test
    void kameletKustomizationUsesKameletManifest() {
        String kustomize = GitOpsManifestGenerator.kustomization("s3-to-db-kamelet", IntegrationType.CAMEL_KAMELET);
        assertTrue(kustomize.contains("kamelet.yaml"));
    }

    @Test
    void sonataFlowCrWrapsWorkflow() {
        String cr = GitOpsManifestGenerator.sonataFlowCr("saga-workflow", "kogito-bpm", """
                id: saga-workflow
                version: "1.0"
                """);
        assertTrue(cr.contains("kind: SonataFlow"));
        assertTrue(cr.contains("namespace: kogito-bpm"));
        assertTrue(cr.contains("id: saga-workflow"));
    }
}
