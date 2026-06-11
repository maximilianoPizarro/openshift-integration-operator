package io.platform.operator;

import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.quarkus.runtime.Startup;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.Map;

/**
 * Creates or updates the ConsolePlugin CR at operator startup so the
 * OpenShift Console discovers the integration plugin automatically.
 * This removes the dependency on OLM bundle manifests for the CR.
 */
@ApplicationScoped
@Startup
public class ConsolePluginReconciler {

    private static final Logger LOG = Logger.getLogger(ConsolePluginReconciler.class);
    private static final String CONSOLE_PLUGIN_NAME = "integration-console-plugin";
    private static final String API_VERSION = "console.openshift.io/v1";

    @Inject
    KubernetesClient kubernetesClient;

    @ConfigProperty(name = "platform.namespace", defaultValue = "openshift-integration")
    String platformNamespace;

    @ConfigProperty(name = "console-plugin.version", defaultValue = "0.4.1")
    String pluginVersion;

    @ConfigProperty(name = "console-plugin.operator-service-port", defaultValue = "8443")
    int operatorServicePort;

    @ConfigProperty(name = "console-plugin.backend-port", defaultValue = "9443")
    int backendPort;

    void onStart(@jakarta.enterprise.event.Observes io.quarkus.runtime.StartupEvent ev) {
        try {
            reconcileConsolePlugin();
        } catch (Exception e) {
            LOG.warnf("Could not reconcile ConsolePlugin CR: %s", e.getMessage());
        }
    }

    void reconcileConsolePlugin() {
        var existing = kubernetesClient.genericKubernetesResources(API_VERSION, "ConsolePlugin")
                .withName(CONSOLE_PLUGIN_NAME)
                .get();

        var consolePlugin = buildConsolePlugin();

        if (existing == null) {
            kubernetesClient.resource(consolePlugin).create();
            LOG.infof("Created ConsolePlugin '%s' v%s", CONSOLE_PLUGIN_NAME, pluginVersion);
        } else {
            kubernetesClient.resource(consolePlugin).update();
            LOG.infof("Updated ConsolePlugin '%s' v%s", CONSOLE_PLUGIN_NAME, pluginVersion);
        }
    }

    private GenericKubernetesResource buildConsolePlugin() {
        var resource = new GenericKubernetesResourceBuilder()
                .withApiVersion(API_VERSION)
                .withKind("ConsolePlugin")
                .withMetadata(new ObjectMetaBuilder()
                        .withName(CONSOLE_PLUGIN_NAME)
                        .addToAnnotations("console.openshift.io/description",
                                "Real-Time Integration & Orchestration Platform — Apache Camel + SonataFlow with Kaoto designer")
                        .addToLabels("app.kubernetes.io/name", CONSOLE_PLUGIN_NAME)
                        .addToLabels("app.kubernetes.io/version", pluginVersion)
                        .addToLabels("app.kubernetes.io/part-of", "openshift-integration-operator")
                        .addToLabels("app.kubernetes.io/managed-by", "openshift-integration-operator")
                        .build())
                .build();

        var proxy = Map.of(
                "alias", "backend",
                "authorization", "UserToken",
                "endpoint", Map.of(
                        "type", "Service",
                        "service", Map.of(
                                "name", "openshift-integration-operator",
                                "namespace", platformNamespace,
                                "port", operatorServicePort)));

        var backend = Map.of(
                "type", "Service",
                "service", Map.of(
                        "name", CONSOLE_PLUGIN_NAME,
                        "namespace", platformNamespace,
                        "port", backendPort,
                        "basePath", "/"));

        var spec = Map.of(
                "displayName", (Object) "Integration Platform",
                "proxy", List.of(proxy),
                "backend", backend);

        resource.setAdditionalProperties(Map.of("spec", spec));
        return resource;
    }
}
