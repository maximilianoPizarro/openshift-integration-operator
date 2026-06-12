package io.platform.ephemeral;

import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.Map;

@ApplicationScoped
public class EphemeralCleanupService {

    private static final Logger LOG = Logger.getLogger(EphemeralCleanupService.class);

    @Inject
    KubernetesClient kubernetesClient;

    @ConfigProperty(name = "sonataflow.namespace", defaultValue = "kogito-bpm")
    String defaultSonataFlowNamespace;

    public void cleanup(String flowName, String namespace) {
        cleanup(flowName, namespace, null);
    }

    public void cleanup(String flowName, String namespace, IntegrationFlowStatus status) {
        Map<String, String> selector = Map.of(
                EphemeralResourceLabels.LABEL_EPHEMERAL, "true",
                EphemeralResourceLabels.LABEL_FLOW_NAME, flowName);

        kubernetesClient.apps().deployments().inNamespace(namespace)
                .withLabels(selector).delete();
        kubernetesClient.services().inNamespace(namespace)
                .withLabels(selector).delete();
        kubernetesClient.configMaps().inNamespace(namespace)
                .withLabels(selector).delete();
        kubernetesClient.batch().v1().jobs().inNamespace(namespace)
                .withLabels(selector).delete();

        try {
            kubernetesClient.genericKubernetesResources("autoscaling/v2", "HorizontalPodAutoscaler")
                    .inNamespace(namespace)
                    .withLabel(EphemeralResourceLabels.LABEL_FLOW_NAME, flowName)
                    .delete();
        } catch (Exception e) {
            LOG.debugf("HPA cleanup skipped: %s", e.getMessage());
        }

        try {
            kubernetesClient.genericKubernetesResources("camel.apache.org/v1", "Kamelet")
                    .inNamespace(namespace).withLabels(selector).delete();
            kubernetesClient.genericKubernetesResources("camel.apache.org/v1", "Pipe")
                    .inNamespace(namespace).withLabels(selector).delete();
            kubernetesClient.genericKubernetesResources("camel.apache.org/v1", "Integration")
                    .inNamespace(namespace).withLabels(selector).delete();
        } catch (Exception e) {
            LOG.debugf("Camel K cleanup skipped: %s", e.getMessage());
        }

        cleanupSonataFlow(flowName, status);

        LOG.infof("Cleaned up ephemeral resources for flow %s in %s", flowName, namespace);
    }

    private void cleanupSonataFlow(String flowName, IntegrationFlowStatus status) {
        String sfName = status != null && status.getSonataFlowName() != null && !status.getSonataFlowName().isBlank()
                ? status.getSonataFlowName()
                : "iflow-" + flowName;
        String sfNamespace = status != null && status.getSonataFlowNamespace() != null
                && !status.getSonataFlowNamespace().isBlank()
                ? status.getSonataFlowNamespace()
                : defaultSonataFlowNamespace;

        try {
            kubernetesClient.genericKubernetesResources("sonataflow.org/v1alpha08", "SonataFlow")
                    .inNamespace(sfNamespace)
                    .withName(sfName)
                    .delete();
        } catch (Exception e) {
            LOG.debugf("SonataFlow cleanup skipped for %s/%s: %s", sfNamespace, sfName, e.getMessage());
        }
    }
}
