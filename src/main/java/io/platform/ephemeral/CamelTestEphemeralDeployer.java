package io.platform.ephemeral;

import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.service.ScaffoldingService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.Map;

@ApplicationScoped
public class CamelTestEphemeralDeployer {

    private static final Logger LOG = Logger.getLogger(CamelTestEphemeralDeployer.class);

    @Inject
    KubernetesClient kubernetesClient;

    @ConfigProperty(name = "ephemeral.camel-test-image",
            defaultValue = "quay.io/maximilianopizarro/camel-test-runner:v0.2.0")
    String testImage;

    public String deploy(String flowName, String namespace, ScaffoldingService.ScaffoldResult scaffold) {
        String cmName = "iflow-" + flowName + "-test-sources";
        String jobName = "iflow-" + flowName + "-test";

        var labels = CamelRouteEphemeralDeployer.ephemeralLabels(flowName);

        var configMap = new io.fabric8.kubernetes.api.model.ConfigMapBuilder()
                .withNewMetadata()
                    .withName(cmName)
                    .withNamespace(namespace)
                    .withLabels(labels)
                .endMetadata()
                .withData(Map.of(
                        "test.camel.yaml", scaffold.workflowDefinition(),
                        "application.properties", scaffold.applicationProperties()))
                .build();
        kubernetesClient.configMaps().inNamespace(namespace).resource(configMap).createOrReplace();

        var container = Map.of(
                "name", "test-runner",
                "image", testImage,
                "command", List.of("sh", "-c", "echo 'Running Camel test' && sleep 30"),
                "volumeMounts", List.of(Map.of("name", "sources", "mountPath", "/deployments/config")));

        var podSpec = Map.of(
                "restartPolicy", "Never",
                "containers", List.of(container),
                "volumes", List.of(Map.of("name", "sources", "configMap", Map.of("name", cmName))));

        var job = new GenericKubernetesResourceBuilder()
                .withApiVersion("batch/v1")
                .withKind("Job")
                .withMetadata(new ObjectMetaBuilder()
                        .withName(jobName)
                        .withNamespace(namespace)
                        .withLabels(labels)
                        .build())
                .build();
        job.setAdditionalProperties(Map.of(
                "spec", Map.of(
                        "backoffLimit", 0,
                        "template", Map.of("spec", podSpec))));

        kubernetesClient.resource(job).inNamespace(namespace).createOrReplace();

        LOG.infof("Deployed ephemeral Camel test job %s", jobName);
        return "job/" + jobName;
    }
}
