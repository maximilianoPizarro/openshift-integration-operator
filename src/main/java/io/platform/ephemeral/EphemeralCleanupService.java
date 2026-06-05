package io.platform.ephemeral;

import io.fabric8.kubernetes.client.KubernetesClient;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Map;

@ApplicationScoped
public class EphemeralCleanupService {

    private static final Logger LOG = Logger.getLogger(EphemeralCleanupService.class);

    @Inject
    KubernetesClient kubernetesClient;

    public void cleanup(String flowName, String namespace) {
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
            kubernetesClient.genericKubernetesResources("camel.apache.org/v1", "Kamelet")
                    .inNamespace(namespace).withLabels(selector).delete();
            kubernetesClient.genericKubernetesResources("camel.apache.org/v1", "Pipe")
                    .inNamespace(namespace).withLabels(selector).delete();
        } catch (Exception e) {
            LOG.debugf("Camel K cleanup skipped: %s", e.getMessage());
        }

        try {
            kubernetesClient.genericKubernetesResources("sonataflow.org/v1alpha08", "SonataFlow")
                    .inNamespace("kogito-bpm")
                    .withName("iflow-" + flowName)
                    .delete();
        } catch (Exception e) {
            LOG.debugf("SonataFlow cleanup skipped: %s", e.getMessage());
        }

        LOG.infof("Cleaned up ephemeral resources for flow %s", flowName);
    }
}
