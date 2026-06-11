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
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.Map;

/**
 * Deploys Kaoto (Deployment + Service + Route on OpenShift) at operator startup.
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

    @ConfigProperty(name = "platform.namespace", defaultValue = "openshift-integration")
    String platformNamespace;

    @ConfigProperty(name = "kaoto.enabled", defaultValue = "true")
    boolean kaotoEnabled;

    @ConfigProperty(name = "kaoto.image", defaultValue = "quay.io/kaotoio/kaoto-app:main")
    String kaotoImage;

    @ConfigProperty(name = "kaoto.replicas", defaultValue = "1")
    int kaotoReplicas;

    void onStart(@jakarta.enterprise.event.Observes io.quarkus.runtime.StartupEvent ev) {
        if (!kaotoEnabled) {
            LOG.info("Kaoto deployment disabled (kaoto.enabled=false)");
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
            LOG.infof("OpenShift Route API not available; skipping Kaoto Route (ClusterIP only): %s", e.getMessage());
        }
        LOG.infof("Reconciled Kaoto in namespace '%s' (image: %s)", platformNamespace, kaotoImage);
    }

    private void reconcileDeployment() {
        Deployment desired = new DeploymentBuilder()
                .withNewMetadata()
                    .withName(KAOTO_NAME)
                    .withNamespace(platformNamespace)
                    .addToLabels("app", KAOTO_NAME)
                    .addToLabels("app.kubernetes.io/part-of", "integration-platform")
                    .addToLabels("app.kubernetes.io/managed-by", "openshift-integration-operator")
                    .addToLabels("app.openshift.io/runtime", "camel")
                .endMetadata()
                .withNewSpec()
                    .withReplicas(kaotoReplicas)
                    .withNewSelector().addToMatchLabels("app", KAOTO_NAME).endSelector()
                    .withNewTemplate()
                        .withNewMetadata().addToLabels("app", KAOTO_NAME).endMetadata()
                        .withNewSpec()
                            .addNewContainer()
                                .withName(KAOTO_NAME)
                                .withImage(kaotoImage)
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
                .inNamespace(platformNamespace).withName(KAOTO_NAME).get();
        if (existing == null) {
            kubernetesClient.apps().deployments().inNamespace(platformNamespace).resource(desired).create();
            LOG.infof("Created Kaoto Deployment '%s'", KAOTO_NAME);
        } else {
            desired.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            kubernetesClient.apps().deployments().inNamespace(platformNamespace).resource(desired).update();
            LOG.infof("Updated Kaoto Deployment '%s'", KAOTO_NAME);
        }
    }

    private void reconcileService() {
        var service = new ServiceBuilder()
                .withNewMetadata()
                    .withName(KAOTO_NAME)
                    .withNamespace(platformNamespace)
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

        var existing = kubernetesClient.services().inNamespace(platformNamespace).withName(KAOTO_NAME).get();
        if (existing == null) {
            kubernetesClient.services().inNamespace(platformNamespace).resource(service).create();
            LOG.infof("Created Kaoto Service '%s'", KAOTO_NAME);
        } else {
            service.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            kubernetesClient.services().inNamespace(platformNamespace).resource(service).replace();
            LOG.infof("Updated Kaoto Service '%s'", KAOTO_NAME);
        }
    }

    private void reconcileRoute() {
        var route = new GenericKubernetesResourceBuilder()
                .withApiVersion(ROUTE_API)
                .withKind("Route")
                .withMetadata(new ObjectMetaBuilder()
                        .withName(KAOTO_NAME)
                        .withNamespace(platformNamespace)
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
                .inNamespace(platformNamespace).withName(KAOTO_NAME).get();
        if (existing == null) {
            kubernetesClient.resource(route).inNamespace(platformNamespace).create();
            LOG.infof("Created Kaoto Route '%s'", KAOTO_NAME);
        } else {
            route.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            kubernetesClient.resource(route).inNamespace(platformNamespace).replace();
            LOG.infof("Updated Kaoto Route '%s'", KAOTO_NAME);
        }
    }
}
