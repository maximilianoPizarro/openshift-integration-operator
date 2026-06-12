package io.platform.ephemeral;

import io.fabric8.kubernetes.api.model.OwnerReference;
import io.fabric8.kubernetes.api.model.EnvFromSourceBuilder;
import io.fabric8.kubernetes.api.model.SecretVolumeSourceBuilder;
import io.fabric8.kubernetes.api.model.Volume;
import io.fabric8.kubernetes.api.model.VolumeBuilder;
import io.fabric8.kubernetes.api.model.VolumeMount;
import io.fabric8.kubernetes.api.model.VolumeMountBuilder;
import io.fabric8.kubernetes.api.model.apps.Deployment;
import io.fabric8.kubernetes.api.model.apps.DeploymentBuilder;
import io.fabric8.kubernetes.api.model.apps.DeploymentSpecBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.api.v1alpha1.EphemeralSpec;
import io.platform.api.v1alpha1.IntegrationType;
import io.platform.api.v1alpha1.ResilienceSpec;
import io.platform.api.v1alpha1.SecretRef;
import io.platform.service.CamelComponentDetector;
import io.platform.service.ScaffoldingService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class CamelRouteEphemeralDeployer {

    private static final Logger LOG = Logger.getLogger(CamelRouteEphemeralDeployer.class);

    @Inject
    KubernetesClient kubernetesClient;

    @Inject
    EphemeralWorkerImageResolver imageResolver;

    @Inject
    CamelComponentDetector componentDetector;

    @Inject
    EphemeralConfigMerger configMerger;

    public String deploy(String flowName, String namespace, ScaffoldingService.ScaffoldResult scaffold) {
        return deploy(flowName, namespace, scaffold, IntegrationType.CAMEL_ROUTE, null, null, null);
    }

    public String deploy(String flowName, String namespace, ScaffoldingService.ScaffoldResult scaffold,
                         IntegrationType integrationType) {
        return deploy(flowName, namespace, scaffold, integrationType, null, null, null);
    }

    public String deploy(String flowName, String namespace, ScaffoldingService.ScaffoldResult scaffold,
                         IntegrationType integrationType, String workerImageOverride) {
        return deploy(flowName, namespace, scaffold, integrationType, workerImageOverride, null, null);
    }

    /**
     * Full deploy with config merge and secret wiring.
     */
    public String deploy(String flowName, String namespace, ScaffoldingService.ScaffoldResult scaffold,
                         IntegrationType integrationType, String workerImageOverride,
                         EphemeralSpec ephemeralSpec, ResilienceSpec resilience) {
        return deploy(flowName, namespace, scaffold, integrationType, workerImageOverride,
                ephemeralSpec, resilience, null);
    }

    public String deploy(String flowName, String namespace, ScaffoldingService.ScaffoldResult scaffold,
                         IntegrationType integrationType, String workerImageOverride,
                         EphemeralSpec ephemeralSpec, ResilienceSpec resilience,
                         List<SecretRef> secrets) {
        return deploy(flowName, namespace, scaffold, integrationType, workerImageOverride,
                ephemeralSpec, resilience, secrets, null);
    }

    public String deploy(String flowName, String namespace, ScaffoldingService.ScaffoldResult scaffold,
                         IntegrationType integrationType, String workerImageOverride,
                         EphemeralSpec ephemeralSpec, ResilienceSpec resilience,
                         List<SecretRef> secrets, OwnerReference ownerRef) {
        Set<String> components = scaffold.detectedComponents() != null && !scaffold.detectedComponents().isEmpty()
                ? scaffold.detectedComponents()
                : componentDetector.detectComponents(scaffold.workflowDefinition());

        String workerImage;
        if (workerImageOverride != null && !workerImageOverride.isBlank()) {
            workerImage = workerImageOverride;
            LOG.infof("Ephemeral worker for %s: using explicit workerImage=%s", flowName, workerImage);
        } else {
            workerImage = imageResolver.resolveWorkerImage(components, integrationType);
            LOG.infof("Ephemeral worker for %s: image=%s components=%s", flowName, workerImage, components);
        }

        String mergedProperties = configMerger.merge(
                components, scaffold.applicationProperties(), ephemeralSpec, resilience);

        String cmName = "iflow-" + flowName + "-sources";
        String deployName = "iflow-" + flowName + "-worker";
        String svcName = "iflow-" + flowName;

        Map<String, String> labels = ephemeralLabels(flowName);

        Map<String, String> cmData = new HashMap<>();
        cmData.put("flow.camel.yaml", scaffold.workflowDefinition());
        if (!mergedProperties.isBlank()) {
            cmData.put("application.properties", mergedProperties);
        }

        boolean hasExternalProperties = !mergedProperties.isBlank();

        var ownerRefs = EphemeralOwnerReferenceHelper.asList(ownerRef);
        var configMap = new io.fabric8.kubernetes.api.model.ConfigMapBuilder()
                .withNewMetadata()
                    .withName(cmName)
                    .withNamespace(namespace)
                    .withLabels(labels)
                    .withOwnerReferences(ownerRefs)
                .endMetadata()
                .withData(cmData)
                .build();
        kubernetesClient.configMaps().inNamespace(namespace).resource(configMap).createOrReplace();

        List<Volume> extraVolumes = new ArrayList<>();
        List<VolumeMount> extraMounts = new ArrayList<>();
        List<io.fabric8.kubernetes.api.model.EnvFromSource> envFromSources = new ArrayList<>();

        if (secrets != null) {
            for (SecretRef ref : secrets) {
                if (ref.isEnvFrom()) {
                    envFromSources.add(new EnvFromSourceBuilder()
                            .withNewSecretRef(ref.getName(), false)
                            .build());
                } else if (ref.getMountPath() != null && !ref.getMountPath().isBlank()) {
                    String volName = "secret-" + ref.getName();
                    extraVolumes.add(new VolumeBuilder()
                            .withName(volName)
                            .withSecret(new SecretVolumeSourceBuilder()
                                    .withSecretName(ref.getName())
                                    .withDefaultMode(420).build())
                            .build());
                    var mountBuilder = new VolumeMountBuilder()
                            .withName(volName)
                            .withMountPath(ref.getMountPath())
                            .withReadOnly(true);
                    if (ref.getSubPath() != null && !ref.getSubPath().isBlank()) {
                        mountBuilder.withSubPath(ref.getSubPath());
                    }
                    extraMounts.add(mountBuilder.build());
                }
            }
        }

        var containerBuilder = new io.fabric8.kubernetes.api.model.ContainerBuilder()
                .withName("worker")
                .withImage(workerImage)
                .addNewPort().withContainerPort(8080).endPort()
                .addNewEnv()
                    .withName("QUARKUS_CAMEL_MAIN_ROUTES_INCLUDE_PATTERN")
                    .withValue("file:/deployments/config/flow.camel.yaml")
                .endEnv();

        if (hasExternalProperties) {
            containerBuilder.addNewEnv()
                    .withName("QUARKUS_CONFIG_LOCATIONS")
                    .withValue("file:/deployments/config/application.properties")
                    .endEnv();
        }

        containerBuilder
                .addNewVolumeMount()
                    .withName("sources")
                    .withMountPath("/deployments/config")
                .endVolumeMount();

        for (VolumeMount vm : extraMounts) {
            containerBuilder.addToVolumeMounts(vm);
        }
        if (!envFromSources.isEmpty()) {
            containerBuilder.withEnvFrom(envFromSources);
        }

        var podSpecBuilder = new io.fabric8.kubernetes.api.model.PodSpecBuilder()
                .withContainers(containerBuilder.build())
                .addNewVolume()
                    .withName("sources")
                    .withNewConfigMap().withName(cmName).endConfigMap()
                .endVolume();
        for (Volume v : extraVolumes) {
            podSpecBuilder.addToVolumes(v);
        }

        Deployment deployment = new DeploymentBuilder()
                .withNewMetadata()
                    .withName(deployName)
                    .withNamespace(namespace)
                    .withLabels(labels)
                    .withOwnerReferences(ownerRefs)
                .endMetadata()
                .withSpec(new DeploymentSpecBuilder()
                        .withReplicas(1)
                        .withNewSelector().addToMatchLabels(labels).endSelector()
                        .withNewTemplate()
                            .withNewMetadata().addToLabels(labels).endMetadata()
                            .withSpec(podSpecBuilder.build())
                        .endTemplate()
                        .build())
                .build();
        kubernetesClient.apps().deployments().inNamespace(namespace).resource(deployment).createOrReplace();

        var service = new io.fabric8.kubernetes.api.model.ServiceBuilder()
                .withNewMetadata()
                    .withName(svcName)
                    .withNamespace(namespace)
                    .withLabels(labels)
                    .withOwnerReferences(ownerRefs)
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

        LOG.infof("Deployed ephemeral Camel route worker %s in %s (properties=%d keys, secrets=%d)",
                deployName, namespace,
                mergedProperties.isBlank() ? 0 : mergedProperties.split("\n").length,
                secrets != null ? secrets.size() : 0);
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
