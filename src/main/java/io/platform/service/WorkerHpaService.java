package io.platform.service;

import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.api.model.OwnerReference;
import io.fabric8.kubernetes.client.KubernetesClient;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.Map;

/**
 * Reconciles one HorizontalPodAutoscaler per IntegrationFlow worker Deployment.
 */
@ApplicationScoped
public class WorkerHpaService {

    private static final Logger LOG = Logger.getLogger(WorkerHpaService.class);

    @Inject
    KubernetesClient kubernetesClient;

    @ConfigProperty(name = "workers.enabled", defaultValue = "true")
    boolean enabled;

    @ConfigProperty(name = "workers.min-replicas", defaultValue = "1")
    int minReplicas;

    @ConfigProperty(name = "workers.max-replicas", defaultValue = "10")
    int maxReplicas;

    @ConfigProperty(name = "workers.target-cpu-utilization", defaultValue = "70")
    int targetCpuUtilization;

    @ConfigProperty(name = "workers.target-memory-utilization", defaultValue = "80")
    int targetMemoryUtilization;

    public void reconcile(String namespace, String flowName, String deploymentName,
                          Map<String, String> labels, List<OwnerReference> ownerRefs) {
        if (!enabled) {
            return;
        }
        String hpaName = GitOpsManifestGenerator.hpaName(flowName);

        var hpa = new io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder()
                .withApiVersion("autoscaling/v2")
                .withKind("HorizontalPodAutoscaler")
                .withMetadata(new ObjectMetaBuilder()
                        .withName(hpaName)
                        .withNamespace(namespace)
                        .withLabels(labels != null ? labels : Map.of(
                                "platform.io/flow-name", flowName,
                                "platform.io/component", "worker-hpa",
                                "app.kubernetes.io/part-of", "integration-platform"))
                        .withOwnerReferences(ownerRefs != null ? ownerRefs : List.of())
                        .build())
                .build();

        var scaleTargetRef = Map.of(
                "apiVersion", "apps/v1",
                "kind", "Deployment",
                "name", deploymentName);

        var metrics = List.of(
                Map.of(
                        "type", "Resource",
                        "resource", Map.of(
                                "name", "cpu",
                                "target", Map.of(
                                        "type", "Utilization",
                                        "averageUtilization", targetCpuUtilization))),
                Map.of(
                        "type", "Resource",
                        "resource", Map.of(
                                "name", "memory",
                                "target", Map.of(
                                        "type", "Utilization",
                                        "averageUtilization", targetMemoryUtilization))));

        var spec = Map.of(
                "scaleTargetRef", scaleTargetRef,
                "minReplicas", minReplicas,
                "maxReplicas", maxReplicas,
                "metrics", metrics);
        hpa.setAdditionalProperties(Map.of("spec", spec));

        kubernetesClient.resource(hpa).inNamespace(namespace).createOrReplace();
        LOG.infof("Reconciled HPA '%s' for deployment '%s' in %s", hpaName, deploymentName, namespace);
    }

    public void deleteByFlowName(String namespace, String flowName) {
        try {
            kubernetesClient.genericKubernetesResources("autoscaling/v2", "HorizontalPodAutoscaler")
                    .inNamespace(namespace)
                    .withName(GitOpsManifestGenerator.hpaName(flowName))
                    .delete();
        } catch (Exception e) {
            LOG.debugf("HPA cleanup skipped for %s: %s", flowName, e.getMessage());
        }
    }
}
