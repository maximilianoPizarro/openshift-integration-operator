package io.platform.service;

import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.GenericKubernetesResourceList;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.base.CustomResourceDefinitionContext;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class DefaultArgoService implements ArgoService {

    private static final Logger LOG = Logger.getLogger(DefaultArgoService.class);
    private static final String ARGO_NS = "openshift-gitops";

    @Inject
    KubernetesClient client;

    private static final CustomResourceDefinitionContext APPSET_CTX = new CustomResourceDefinitionContext.Builder()
        .withGroup("argoproj.io")
        .withVersion("v1alpha1")
        .withPlural("applicationsets")
        .withScope("Namespaced")
        .build();

    private static final CustomResourceDefinitionContext APP_CTX = new CustomResourceDefinitionContext.Builder()
        .withGroup("argoproj.io")
        .withVersion("v1alpha1")
        .withPlural("applications")
        .withScope("Namespaced")
        .build();

    @Override
    public void reconcileApplicationSet(String name, String namespace, String gitRepoUrl,
                                         String branch, String path,
                                         Map<String, String> clusterSelector,
                                         List<String> excludeClusters) {
        String appSetName = name + "-appset";
        LOG.infof("Reconciling ApplicationSet %s in %s", appSetName, ARGO_NS);

        Map<String, Object> appSetSpec = buildApplicationSetSpec(
            name, gitRepoUrl, branch, path, clusterSelector, excludeClusters);

        try {
            GenericKubernetesResource existing = client.genericKubernetesResources(APPSET_CTX)
                .inNamespace(ARGO_NS)
                .withName(appSetName)
                .get();

            if (existing == null) {
                GenericKubernetesResource appSet = new GenericKubernetesResource();
                appSet.setApiVersion("argoproj.io/v1alpha1");
                appSet.setKind("ApplicationSet");
                appSet.setMetadata(new ObjectMetaBuilder()
                    .withName(appSetName)
                    .withNamespace(ARGO_NS)
                    .withLabels(Map.of(
                        "kaoto.io/integration", name,
                        "app.kubernetes.io/managed-by", "integration-operator"
                    ))
                    .build());
                appSet.setAdditionalProperties(Map.of("spec", appSetSpec));

                client.genericKubernetesResources(APPSET_CTX)
                    .inNamespace(ARGO_NS)
                    .resource(appSet)
                    .create();
                LOG.infof("Created ApplicationSet %s", appSetName);
            } else {
                existing.setAdditionalProperties(Map.of("spec", appSetSpec));
                client.genericKubernetesResources(APPSET_CTX)
                    .inNamespace(ARGO_NS)
                    .resource(existing)
                    .update();
                LOG.infof("Updated ApplicationSet %s", appSetName);
            }
        } catch (Exception e) {
            LOG.warnf(e, "Failed to reconcile ApplicationSet %s — ArgoCD may not be installed", appSetName);
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<IntegrationFlowStatus.ClusterDeployment> getClusterDeployments(String applicationSetName) {
        List<IntegrationFlowStatus.ClusterDeployment> deployments = new ArrayList<>();
        try {
            GenericKubernetesResourceList apps = client.genericKubernetesResources(APP_CTX)
                .inNamespace(ARGO_NS)
                .withLabel("kaoto.io/integration", applicationSetName.replace("-appset", ""))
                .list();

            for (GenericKubernetesResource app : apps.getItems()) {
                IntegrationFlowStatus.ClusterDeployment cd = new IntegrationFlowStatus.ClusterDeployment();
                cd.setApplicationName(app.getMetadata().getName());

                Map<String, Object> props = app.getAdditionalProperties();
                if (props.containsKey("status")) {
                    Map<String, Object> status = (Map<String, Object>) props.get("status");
                    Map<String, Object> sync = (Map<String, Object>) status.getOrDefault("sync", Map.of());
                    Map<String, Object> health = (Map<String, Object>) status.getOrDefault("health", Map.of());

                    cd.setSyncStatus(String.valueOf(sync.getOrDefault("status", "Unknown")));
                    cd.setHealthStatus(String.valueOf(health.getOrDefault("status", "Unknown")));
                }

                Map<String, Object> spec = (Map<String, Object>) props.getOrDefault("spec", Map.of());
                Map<String, Object> dest = (Map<String, Object>) spec.getOrDefault("destination", Map.of());
                cd.setClusterName(String.valueOf(dest.getOrDefault("name", dest.getOrDefault("server", "unknown"))));
                cd.setLastSyncTime(java.time.Instant.now().toString());

                deployments.add(cd);
            }
        } catch (Exception e) {
            LOG.warnf("Failed to list ArgoCD Applications: %s", e.getMessage());
        }
        return deployments;
    }

    @Override
    public void deleteApplicationSet(String name, String namespace) {
        try {
            client.genericKubernetesResources(APPSET_CTX)
                .inNamespace(ARGO_NS)
                .withName(name + "-appset")
                .delete();
        } catch (Exception e) {
            LOG.warnf("Failed to delete ApplicationSet: %s", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> buildApplicationSetSpec(String name, String gitRepoUrl,
                                                         String branch, String path,
                                                         Map<String, String> clusterSelector,
                                                         List<String> excludeClusters) {
        Map<String, Object> gitGenerator = Map.of(
            "git", Map.of(
                "repoURL", gitRepoUrl,
                "revision", branch,
                "directories", List.of(Map.of("path", path != null ? path : "base"))
            )
        );

        Map<String, Object> clusterGen;
        if (clusterSelector != null && !clusterSelector.isEmpty()) {
            clusterGen = Map.of("clusters", Map.of("selector", Map.of("matchLabels", clusterSelector)));
        } else {
            clusterGen = Map.of("clusters", Map.of());
        }

        Map<String, Object> matrixGenerator = Map.of(
            "matrix", Map.of("generators", List.of(gitGenerator, clusterGen))
        );

        Map<String, Object> template = Map.of(
            "metadata", Map.of(
                "name", name + "-{{name}}",
                "labels", Map.of("kaoto.io/integration", name)
            ),
            "spec", Map.of(
                "project", "default",
                "source", Map.of(
                    "repoURL", gitRepoUrl,
                    "targetRevision", branch,
                    "path", "{{path}}"
                ),
                "destination", Map.of(
                    "server", "{{server}}",
                    "namespace", "openshift-integration"
                ),
                "syncPolicy", Map.of(
                    "automated", Map.of("prune", true, "selfHeal", true),
                    "syncOptions", List.of("CreateNamespace=true")
                )
            )
        );

        return Map.of(
            "generators", List.of(matrixGenerator),
            "template", template
        );
    }
}
