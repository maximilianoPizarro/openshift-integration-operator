package io.platform.operator;

import io.fabric8.kubernetes.api.model.HasMetadata;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.quarkus.runtime.Startup;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.ConfigProvider;
import org.jboss.logging.Logger;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Deploys Tekton Task + Pipeline for GitOps builds in the platform namespace.
 * Skipped when Tekton CRDs are absent or {@code tekton.enabled=false}.
 */
@ApplicationScoped
@Startup
public class TektonReconciler {

    private static final Logger LOG = Logger.getLogger(TektonReconciler.class);
    static final String PIPELINE_NAME = "integration-flow-build";
    static final String TASK_NAME = "populate-scaffold";

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
            LOG.debug("Tekton deployment disabled (tekton.enabled=false)");
            return;
        }
        if (!tektonAvailable()) {
            LOG.debug("Tekton CRDs not available — skipping pipeline reconciliation");
            return;
        }
        try {
            reconcileTektonResources();
        } catch (Exception e) {
            LOG.warnf("Could not reconcile Tekton resources: %s", e.getMessage());
        }
    }

    void reconcileTektonResources() {
        reconcileResource("tekton/populate-scaffold-task.yaml");
        reconcileResource("tekton/integration-flow-build-pipeline.yaml");
        LOG.infof("Reconciled Tekton Task '%s' and Pipeline '%s' in namespace '%s'",
                TASK_NAME, PIPELINE_NAME, namespace());
    }

    private void reconcileResource(String classpathYaml) {
        try (InputStream in = Thread.currentThread().getContextClassLoader().getResourceAsStream(classpathYaml)) {
            if (in == null) {
                throw new IllegalStateException("Missing classpath resource: " + classpathYaml);
            }
            String yaml = new String(in.readAllBytes())
                    .replace("__PLATFORM_NAMESPACE__", namespace());
            List<HasMetadata> resources = kubernetesClient
                    .load(new ByteArrayInputStream(yaml.getBytes(StandardCharsets.UTF_8)))
                    .items();
            for (HasMetadata resource : resources) {
                resource.getMetadata().setNamespace(namespace());
                var existing = kubernetesClient.resource(resource).inNamespace(namespace()).get();
                if (existing == null) {
                    kubernetesClient.resource(resource).inNamespace(namespace()).create();
                    LOG.infof("Created Tekton %s '%s'", resource.getKind(), resource.getMetadata().getName());
                } else {
                    resource.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
                    kubernetesClient.resource(resource).inNamespace(namespace()).replace();
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to reconcile " + classpathYaml, e);
        }
    }

    private static boolean enabled() {
        return ConfigProvider.getConfig()
                .getOptionalValue("tekton.enabled", Boolean.class)
                .orElse(true);
    }

    private static String namespace() {
        return ConfigProvider.getConfig()
                .getOptionalValue("platform.namespace", String.class)
                .orElse("openshift-integration");
    }

    private boolean tektonAvailable() {
        try {
            return kubernetesClient.apiextensions().v1().customResourceDefinitions()
                    .withName("pipelines.tekton.dev")
                    .get() != null;
        } catch (Exception e) {
            return false;
        }
    }
}
