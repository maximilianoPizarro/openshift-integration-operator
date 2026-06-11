package io.platform.operator;

import io.fabric8.kubernetes.api.model.ConfigMapBuilder;
import io.fabric8.kubernetes.api.model.IntOrString;
import io.fabric8.kubernetes.api.model.ServiceBuilder;
import io.fabric8.kubernetes.api.model.apps.Deployment;
import io.fabric8.kubernetes.api.model.apps.DeploymentBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.quarkus.runtime.Startup;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.ConfigProvider;
import org.jboss.logging.Logger;

/**
 * Deploys OpenTelemetry Collector (Deployment + ConfigMap + Services) in the platform namespace.
 * Not included in the OLM bundle — same pattern as {@link KaotoReconciler}.
 */
@ApplicationScoped
@Startup
public class OtelCollectorReconciler {

    private static final Logger LOG = Logger.getLogger(OtelCollectorReconciler.class);
    static final String COLLECTOR_NAME = "integration-otel-collector";
    static final String LEGACY_SERVICE_NAME = "otel-collector";
    static final String CONFIG_KEY = "collector.yaml";

    @Inject
    KubernetesClient kubernetesClient;

    void onStart(@jakarta.enterprise.event.Observes io.quarkus.runtime.StartupEvent ev) {
        reconcileIfEnabled();
    }

    @Scheduled(every = "{platform.sidecar-reconcile-interval}", delayed = "{platform.sidecar-reconcile-delay}")
    void scheduledReconcile() {
        reconcileIfEnabled();
    }

    private void reconcileIfEnabled() {
        if (!enabled()) {
            return;
        }
        try {
            reconcileCollector();
        } catch (Exception e) {
            LOG.warnf("Could not reconcile OpenTelemetry Collector: %s", e.getMessage());
        }
    }

    void reconcileCollector() {
        reconcileConfigMap();
        reconcileDeployment();
        reconcileService(COLLECTOR_NAME);
        reconcileService(LEGACY_SERVICE_NAME);
        LOG.infof("Reconciled OpenTelemetry Collector in namespace '%s' (image: %s)",
                namespace(), image());
    }

    private void reconcileConfigMap() {
        var config = new ConfigMapBuilder()
                .withNewMetadata()
                    .withName(COLLECTOR_NAME + "-config")
                    .withNamespace(namespace())
                    .addToLabels("app", COLLECTOR_NAME)
                    .addToLabels("app.kubernetes.io/part-of", "integration-platform")
                    .addToLabels("app.kubernetes.io/managed-by", "openshift-integration-operator")
                .endMetadata()
                .addToData(CONFIG_KEY, collectorConfig())
                .build();

        var existing = kubernetesClient.configMaps().inNamespace(namespace())
                .withName(COLLECTOR_NAME + "-config").get();
        if (existing == null) {
            kubernetesClient.configMaps().inNamespace(namespace()).resource(config).create();
            LOG.infof("Created ConfigMap '%s-config'", COLLECTOR_NAME);
        } else {
            config.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            kubernetesClient.configMaps().inNamespace(namespace()).resource(config).replace();
        }
    }

    private void reconcileDeployment() {
        Deployment desired = new DeploymentBuilder()
                .withNewMetadata()
                    .withName(COLLECTOR_NAME)
                    .withNamespace(namespace())
                    .addToLabels("app", COLLECTOR_NAME)
                    .addToLabels("app.kubernetes.io/part-of", "integration-platform")
                    .addToLabels("app.kubernetes.io/managed-by", "openshift-integration-operator")
                .endMetadata()
                .withNewSpec()
                    .withReplicas(replicas())
                    .withNewSelector().addToMatchLabels("app", COLLECTOR_NAME).endSelector()
                    .withNewTemplate()
                        .withNewMetadata().addToLabels("app", COLLECTOR_NAME).endMetadata()
                        .withNewSpec()
                            .addNewContainer()
                                .withName("otel-collector")
                                .withImage(image())
                                .withArgs("--config=/conf/" + CONFIG_KEY)
                                .addNewPort().withName("otlp-grpc").withContainerPort(4317).withProtocol("TCP").endPort()
                                .addNewPort().withName("otlp-http").withContainerPort(4318).withProtocol("TCP").endPort()
                                .withNewReadinessProbe()
                                    .withNewHttpGet().withPath("/").withPort(new IntOrString(13133)).endHttpGet()
                                    .withInitialDelaySeconds(5)
                                    .withPeriodSeconds(10)
                                .endReadinessProbe()
                                .withNewLivenessProbe()
                                    .withNewHttpGet().withPath("/").withPort(new IntOrString(13133)).endHttpGet()
                                    .withInitialDelaySeconds(10)
                                    .withPeriodSeconds(30)
                                .endLivenessProbe()
                                .withNewResources()
                                    .addToRequests("cpu", new io.fabric8.kubernetes.api.model.Quantity("100m"))
                                    .addToRequests("memory", new io.fabric8.kubernetes.api.model.Quantity("128Mi"))
                                    .addToLimits("cpu", new io.fabric8.kubernetes.api.model.Quantity("500m"))
                                    .addToLimits("memory", new io.fabric8.kubernetes.api.model.Quantity("512Mi"))
                                .endResources()
                                .addNewVolumeMount()
                                    .withName("config")
                                    .withMountPath("/conf")
                                    .withReadOnly(true)
                                .endVolumeMount()
                            .endContainer()
                            .addNewVolume()
                                .withName("config")
                                .withNewConfigMap()
                                    .withName(COLLECTOR_NAME + "-config")
                                .endConfigMap()
                            .endVolume()
                        .endSpec()
                    .endTemplate()
                .endSpec()
                .build();

        var existing = kubernetesClient.apps().deployments()
                .inNamespace(namespace()).withName(COLLECTOR_NAME).get();
        if (existing == null) {
            kubernetesClient.apps().deployments().inNamespace(namespace()).resource(desired).create();
            LOG.infof("Created OpenTelemetry Collector Deployment '%s'", COLLECTOR_NAME);
        } else {
            desired.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            kubernetesClient.apps().deployments().inNamespace(namespace()).resource(desired).update();
        }
    }

    private void reconcileService(String serviceName) {
        var service = new ServiceBuilder()
                .withNewMetadata()
                    .withName(serviceName)
                    .withNamespace(namespace())
                    .addToLabels("app", COLLECTOR_NAME)
                    .addToLabels("app.kubernetes.io/part-of", "integration-platform")
                    .addToLabels("app.kubernetes.io/managed-by", "openshift-integration-operator")
                .endMetadata()
                .withNewSpec()
                    .addToSelector("app", COLLECTOR_NAME)
                    .addNewPort()
                        .withName("otlp-grpc")
                        .withProtocol("TCP")
                        .withPort(4317)
                        .withTargetPort(new IntOrString("otlp-grpc"))
                    .endPort()
                    .addNewPort()
                        .withName("otlp-http")
                        .withProtocol("TCP")
                        .withPort(4318)
                        .withTargetPort(new IntOrString("otlp-http"))
                    .endPort()
                .endSpec()
                .build();

        var existing = kubernetesClient.services().inNamespace(namespace()).withName(serviceName).get();
        if (existing == null) {
            kubernetesClient.services().inNamespace(namespace()).resource(service).create();
            LOG.infof("Created OpenTelemetry Collector Service '%s'", serviceName);
        } else {
            service.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            kubernetesClient.services().inNamespace(namespace()).resource(service).replace();
        }
    }

    private static String collectorConfig() {
        return """
                receivers:
                  otlp:
                    protocols:
                      grpc:
                        endpoint: 0.0.0.0:4317
                      http:
                        endpoint: 0.0.0.0:4318
                processors:
                  batch:
                exporters:
                  debug:
                    verbosity: basic
                extensions:
                  health_check:
                    endpoint: 0.0.0.0:13133
                service:
                  extensions: [health_check]
                  pipelines:
                    traces:
                      receivers: [otlp]
                      processors: [batch]
                      exporters: [debug]
                    metrics:
                      receivers: [otlp]
                      processors: [batch]
                      exporters: [debug]
                """;
    }

    private static boolean enabled() {
        return ConfigProvider.getConfig()
                .getOptionalValue("otel.collector.enabled", Boolean.class)
                .orElse(true);
    }

    private static String namespace() {
        return ConfigProvider.getConfig()
                .getOptionalValue("platform.namespace", String.class)
                .orElse("openshift-integration");
    }

    private static String image() {
        return ConfigProvider.getConfig()
                .getOptionalValue("otel.collector.image", String.class)
                .orElse("ghcr.io/open-telemetry/opentelemetry-collector-releases/opentelemetry-collector-contrib:0.109.0");
    }

    private static int replicas() {
        return ConfigProvider.getConfig()
                .getOptionalValue("otel.collector.replicas", Integer.class)
                .orElse(1);
    }
}
