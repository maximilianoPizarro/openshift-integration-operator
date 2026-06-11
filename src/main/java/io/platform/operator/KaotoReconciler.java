package io.platform.operator;

import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import io.fabric8.kubernetes.api.model.IntOrString;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
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

import java.util.Map;

/**
 * Deploys Kaoto (Deployment + Service + Route on OpenShift) at operator startup
 * and re-syncs periodically so image/replica env changes apply without a new release.
 * Not included in the OLM bundle to avoid validation issues on vanilla k8s catalogs.
 */
@ApplicationScoped
@Startup
public class KaotoReconciler {

    private static final Logger LOG = Logger.getLogger(KaotoReconciler.class);
    private static final String KAOTO_NAME = "kaoto";
    private static final String ROUTE_API = "route.openshift.io/v1";

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
            LOG.debug("Kaoto deployment disabled (kaoto.enabled=false)");
            return;
        }
        try {
            reconcileKaoto();
        } catch (Exception e) {
            LOG.warnf("Could not reconcile Kaoto resources: %s", e.getMessage());
        }
    }

    void reconcileKaoto() {
        reconcileDeployment();
        reconcileService();
        try {
            reconcileRoute();
        } catch (Exception e) {
            LOG.infof("Skipping Kaoto Route (OpenShift only): %s", e.getMessage());
        }
        LOG.infof("Reconciled Kaoto in namespace '%s' (image: %s)", namespace(), image());
    }

    private void reconcileDeployment() {
        Deployment desired = new DeploymentBuilder()
                .withNewMetadata()
                    .withName(KAOTO_NAME)
                    .withNamespace(namespace())
                    .addToLabels("app", KAOTO_NAME)
                    .addToLabels("app.kubernetes.io/part-of", "integration-platform")
                    .addToLabels("app.kubernetes.io/managed-by", "openshift-integration-operator")
                    .addToLabels("app.openshift.io/runtime", "camel")
                .endMetadata()
                .withNewSpec()
                    .withReplicas(replicas())
                    .withNewSelector().addToMatchLabels("app", KAOTO_NAME).endSelector()
                    .withNewTemplate()
                        .withNewMetadata().addToLabels("app", KAOTO_NAME).endMetadata()
                        .withNewSpec()
                            .addNewContainer()
                                .withName(KAOTO_NAME)
                                .withImage(image())
                                .addNewPort().withContainerPort(8080).withProtocol("TCP").endPort()
                                .withNewReadinessProbe()
                                    .withNewHttpGet().withPath("/").withPort(new IntOrString(8080)).endHttpGet()
                                    .withInitialDelaySeconds(5)
                                    .withPeriodSeconds(10)
                                .endReadinessProbe()
                                .withNewLivenessProbe()
                                    .withNewHttpGet().withPath("/").withPort(new IntOrString(8080)).endHttpGet()
                                    .withInitialDelaySeconds(10)
                                    .withPeriodSeconds(30)
                                .endLivenessProbe()
                                .withNewResources()
                                    .addToRequests("cpu", new io.fabric8.kubernetes.api.model.Quantity("100m"))
                                    .addToRequests("memory", new io.fabric8.kubernetes.api.model.Quantity("256Mi"))
                                    .addToLimits("cpu", new io.fabric8.kubernetes.api.model.Quantity("500m"))
                                    .addToLimits("memory", new io.fabric8.kubernetes.api.model.Quantity("512Mi"))
                                .endResources()
                            .endContainer()
                        .endSpec()
                    .endTemplate()
                .endSpec()
                .build();

        var existing = kubernetesClient.apps().deployments()
                .inNamespace(namespace()).withName(KAOTO_NAME).get();
        if (existing == null) {
            kubernetesClient.apps().deployments().inNamespace(namespace()).resource(desired).create();
            LOG.infof("Created Kaoto Deployment '%s'", KAOTO_NAME);
        } else {
            desired.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            kubernetesClient.apps().deployments().inNamespace(namespace()).resource(desired).update();
            LOG.infof("Updated Kaoto Deployment '%s'", KAOTO_NAME);
        }
    }

    private void reconcileService() {
        var service = new ServiceBuilder()
                .withNewMetadata()
                    .withName(KAOTO_NAME)
                    .withNamespace(namespace())
                    .addToLabels("app", KAOTO_NAME)
                    .addToLabels("app.kubernetes.io/part-of", "integration-platform")
                    .addToLabels("app.kubernetes.io/managed-by", "openshift-integration-operator")
                .endMetadata()
                .withNewSpec()
                    .addToSelector("app", KAOTO_NAME)
                    .addNewPort()
                        .withName("http")
                        .withProtocol("TCP")
                        .withPort(8080)
                        .withTargetPort(new IntOrString(8080))
                    .endPort()
                .endSpec()
                .build();

        var existing = kubernetesClient.services().inNamespace(namespace()).withName(KAOTO_NAME).get();
        if (existing == null) {
            kubernetesClient.services().inNamespace(namespace()).resource(service).create();
            LOG.infof("Created Kaoto Service '%s'", KAOTO_NAME);
        } else {
            service.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            kubernetesClient.services().inNamespace(namespace()).resource(service).replace();
            LOG.infof("Updated Kaoto Service '%s'", KAOTO_NAME);
        }
    }

    private void reconcileRoute() {
        var route = new GenericKubernetesResourceBuilder()
                .withApiVersion(ROUTE_API)
                .withKind("Route")
                .withMetadata(new ObjectMetaBuilder()
                        .withName(KAOTO_NAME)
                        .withNamespace(namespace())
                        .addToLabels("app", KAOTO_NAME)
                        .addToLabels("app.kubernetes.io/part-of", "integration-platform")
                        .addToLabels("app.kubernetes.io/managed-by", "openshift-integration-operator")
                        .build())
                .build();

        var spec = Map.of(
                "to", Map.of("kind", "Service", "name", KAOTO_NAME, "weight", 100),
                "port", Map.of("targetPort", "http"),
                "tls", Map.of(
                        "termination", "edge",
                        "insecureEdgeTerminationPolicy", "Redirect"));

        route.setAdditionalProperties(Map.of("spec", spec));

        var existing = kubernetesClient.genericKubernetesResources(ROUTE_API, "Route")
                .inNamespace(namespace()).withName(KAOTO_NAME).get();
        if (existing == null) {
            kubernetesClient.resource(route).inNamespace(namespace()).create();
            LOG.infof("Created Kaoto Route '%s'", KAOTO_NAME);
        } else {
            route.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            kubernetesClient.resource(route).inNamespace(namespace()).replace();
            LOG.infof("Updated Kaoto Route '%s'", KAOTO_NAME);
        }
    }

    private static boolean enabled() {
        return ConfigProvider.getConfig()
                .getOptionalValue("kaoto.enabled", Boolean.class)
                .orElse(true);
    }

    private static String namespace() {
        return ConfigProvider.getConfig()
                .getOptionalValue("platform.namespace", String.class)
                .orElse("openshift-integration");
    }

    private static String image() {
        return ConfigProvider.getConfig()
                .getOptionalValue("kaoto.image", String.class)
                .orElse("quay.io/kaotoio/kaoto-app:main");
    }

    private static int replicas() {
        return ConfigProvider.getConfig()
                .getOptionalValue("kaoto.replicas", Integer.class)
                .orElse(1);
    }
}
