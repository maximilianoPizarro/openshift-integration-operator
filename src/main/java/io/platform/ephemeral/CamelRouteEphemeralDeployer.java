package io.platform.ephemeral;

import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.api.model.apps.Deployment;
import io.fabric8.kubernetes.api.model.apps.DeploymentBuilder;
import io.fabric8.kubernetes.api.model.apps.DeploymentSpecBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.service.ScaffoldingService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class CamelRouteEphemeralDeployer {

    private static final Logger LOG = Logger.getLogger(CamelRouteEphemeralDeployer.class);

    @Inject
    KubernetesClient kubernetesClient;

    @ConfigProperty(name = "ephemeral.camel-worker-image",
            defaultValue = "quay.io/maximilianopizarro/camel-yaml-worker:v0.2.0")
    String workerImage;

    public String deploy(String flowName, String namespace, ScaffoldingService.ScaffoldResult scaffold) {
        String cmName = "iflow-" + flowName + "-sources";
        String deployName = "iflow-" + flowName + "-worker";
        String svcName = "iflow-" + flowName;

        Map<String, String> labels = ephemeralLabels(flowName);

        var configMap = new io.fabric8.kubernetes.api.model.ConfigMapBuilder()
                .withNewMetadata()
                    .withName(cmName)
                    .withNamespace(namespace)
                    .withLabels(labels)
                .endMetadata()
                .withData(Map.of(
                        "flow.camel.yaml", scaffold.workflowDefinition()))
                .build();
        kubernetesClient.configMaps().inNamespace(namespace).resource(configMap).createOrReplace();

        Deployment deployment = new DeploymentBuilder()
                .withNewMetadata()
                    .withName(deployName)
                    .withNamespace(namespace)
                    .withLabels(labels)
                .endMetadata()
                .withSpec(new DeploymentSpecBuilder()
                        .withReplicas(1)
                        .withNewSelector().addToMatchLabels(labels).endSelector()
                        .withNewTemplate()
                            .withNewMetadata().addToLabels(labels).endMetadata()
                            .withNewSpec()
                                .addNewContainer()
                                    .withName("worker")
                                    .withImage(workerImage)
                                    .addNewPort().withContainerPort(8080).endPort()
                                    .addNewEnv()
                                        .withName("QUARKUS_CAMEL_MAIN_ROUTES_INCLUDE_PATTERN")
                                        .withValue("file:/deployments/config/flow.camel.yaml")
                                    .endEnv()
                                    .addNewVolumeMount()
                                        .withName("sources")
                                        .withMountPath("/deployments/config")
                                    .endVolumeMount()
                                .endContainer()
                                .addNewVolume()
                                    .withName("sources")
                                    .withNewConfigMap().withName(cmName).endConfigMap()
                                .endVolume()
                            .endSpec()
                        .endTemplate()
                        .build())
                .build();
        kubernetesClient.apps().deployments().inNamespace(namespace).resource(deployment).createOrReplace();

        var service = new io.fabric8.kubernetes.api.model.ServiceBuilder()
                .withNewMetadata()
                    .withName(svcName)
                    .withNamespace(namespace)
                    .withLabels(labels)
                .endMetadata()
                .withNewSpec()
                    .addToSelector(labels)
                    .addNewPort()
                        .withPort(8080)
                        .withTargetPort(new io.fabric8.kubernetes.api.model.IntOrString(8080))
                    .endPort()
                .endSpec()
                .build();
        kubernetesClient.services().inNamespace(namespace).resource(service).createOrReplace();

        LOG.infof("Deployed ephemeral Camel route worker %s in %s", deployName, namespace);
        return "deployment/" + deployName;
    }

    static Map<String, String> ephemeralLabels(String flowName) {
        Map<String, String> labels = new HashMap<>();
        labels.put(EphemeralResourceLabels.LABEL_EPHEMERAL, "true");
        labels.put(EphemeralResourceLabels.LABEL_FLOW_NAME, flowName);
        labels.put(EphemeralResourceLabels.LABEL_COMPONENT, "ephemeral-worker");
        labels.put("app.kubernetes.io/part-of", "integration-platform");
        return labels;
    }
}
