package io.platform.ephemeral;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Map;

@ApplicationScoped
public class DefaultSonataFlowEphemeralDeployer implements SonataFlowEphemeralDeployer {

    private static final Logger LOG = Logger.getLogger(DefaultSonataFlowEphemeralDeployer.class);
    private static final String SONATAFLOW_NS = "kogito-bpm";

    @Inject
    KubernetesClient kubernetesClient;

    @Override
    public String deploy(String flowName, String namespace, String kaotoDesign, IntegrationFlowStatus status) {
        String sfName = "iflow-" + flowName;
        if (kaotoDesign == null || kaotoDesign.isBlank()) {
            throw new IllegalArgumentException("kaotoDesign is required for SonataFlow ephemeral deployment");
        }

        try {
            var yamlMapper = new YAMLFactory();
            var objectMapper = new ObjectMapper(yamlMapper);
            @SuppressWarnings("unchecked")
            Map<String, Object> flowSpec = objectMapper.readValue(kaotoDesign, Map.class);

            var labels = CamelRouteEphemeralDeployer.ephemeralLabels(flowName);
            var sonataFlow = new GenericKubernetesResourceBuilder()
                    .withApiVersion("sonataflow.org/v1alpha08")
                    .withKind("SonataFlow")
                    .withMetadata(new ObjectMetaBuilder()
                            .withName(sfName)
                            .withNamespace(SONATAFLOW_NS)
                            .withLabels(labels)
                            .withAnnotations(Map.of(
                                    "sonataflow.org/description", "Managed by Integration Platform (ephemeral)",
                                    "sonataflow.org/version", "1.0"))
                            .build())
                    .build();

            var sfSpec = new java.util.HashMap<String, Object>();
            sfSpec.put("flow", flowSpec);
            sfSpec.put("podTemplate", Map.of(
                    "container", Map.of("resources", Map.of(
                            "requests", Map.of("memory", "256Mi", "cpu", "100m"),
                            "limits", Map.of("memory", "512Mi", "cpu", "500m")))));

            sonataFlow.setAdditionalProperties(Map.of("spec", sfSpec));
            kubernetesClient.resource(sonataFlow).inNamespace(SONATAFLOW_NS).createOrReplace();

            status.setSonataFlowName(sfName);
            status.setSonataFlowNamespace(SONATAFLOW_NS);
            LOG.infof("Deployed ephemeral SonataFlow CR %s in %s", sfName, SONATAFLOW_NS);
            return "sonataflow/" + sfName;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to deploy SonataFlow CR: " + e.getMessage(), e);
        }
    }
}
