package io.platform.lifecycle;

import io.fabric8.kubernetes.api.model.apps.Deployment;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.api.v1alpha1.DeploymentMode;
import io.platform.api.v1alpha1.IntegrationFlow;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import io.platform.api.v1alpha1.IntegrationType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.Map;

@ApplicationScoped
public class FlowLifecycleService {

    private static final Logger LOG = Logger.getLogger(FlowLifecycleService.class);

    @Inject
    KubernetesClient client;

    @ConfigProperty(name = "platform.namespace", defaultValue = "openshift-integration")
    String platformNamespace;

    @ConfigProperty(name = "sonataflow.namespace", defaultValue = "kogito-bpm")
    String sonataFlowNamespace;

    @ConfigProperty(name = "sonataflow.cr-name-prefix", defaultValue = "iflow-")
    String sonataFlowCrPrefix;

    @ConfigProperty(name = "argocd.namespace", defaultValue = "openshift-gitops")
    String argocdNamespace;

    public void apply(IntegrationFlow flow, String desiredState) {
        String flowName = flow.getMetadata().getName();
        switch (desiredState) {
            case "paused", "stopped" -> scaleToZero(flow);
            case "running" -> scaleUp(flow);
            default -> LOG.warnf("Unknown desiredState %s for flow %s", desiredState, flowName);
        }
    }

    private void scaleToZero(IntegrationFlow flow) {
        scaleFlowWorkloads(flow, 0);
        suspendArgoApp(flow, true);
    }

    private void scaleUp(IntegrationFlow flow) {
        scaleFlowWorkloads(flow, 1);
        suspendArgoApp(flow, false);
    }

    private void scaleFlowWorkloads(IntegrationFlow flow, int replicas) {
        String flowName = flow.getMetadata().getName();
        var spec = flow.getSpec();
        IntegrationFlowStatus status = flow.getStatus();

        if (spec != null && spec.getDeploymentMode() == DeploymentMode.EPHEMERAL) {
            scaleDeploymentFromRef(status != null ? status.getEphemeralWorkerRef() : null, platformNamespace, replicas);
            return;
        }

        IntegrationType type = spec != null ? spec.getResolvedType() : IntegrationType.CAMEL_ROUTE;
        if (type == IntegrationType.SONATAFLOW) {
            String ns = status != null && status.getSonataFlowNamespace() != null
                    ? status.getSonataFlowNamespace() : sonataFlowNamespace;
            String name = status != null && status.getSonataFlowName() != null
                    ? status.getSonataFlowName() : sonataFlowCrPrefix + flowName;
            scaleDeployment(ns, name, replicas);
            return;
        }

        scaleDeployment(platformNamespace, sonataFlowCrPrefix + flowName, replicas);
        if (status != null && status.getSonataFlowName() != null && status.getSonataFlowNamespace() != null) {
            scaleDeployment(status.getSonataFlowNamespace(), status.getSonataFlowName(), replicas);
        }
    }

    private void scaleDeploymentFromRef(String workerRef, String defaultNs, int replicas) {
        if (workerRef == null || workerRef.isBlank()) {
            return;
        }
        String name = workerRef.contains("/") ? workerRef.split("/", 2)[1] : workerRef;
        scaleDeployment(defaultNs, name, replicas);
    }

    private void scaleDeployment(String namespace, String name, int replicas) {
        Deployment dep = client.apps().deployments().inNamespace(namespace).withName(name).get();
        if (dep == null) {
            LOG.debugf("Deployment %s/%s not found for lifecycle scale", namespace, name);
            return;
        }
        dep.getSpec().setReplicas(replicas);
        client.apps().deployments().inNamespace(namespace).resource(dep).update();
        LOG.infof("Scaled deployment %s/%s to %d replicas", namespace, name, replicas);
    }

    private void suspendArgoApp(IntegrationFlow flow, boolean suspend) {
        IntegrationFlowStatus status = flow.getStatus();
        if (status == null || status.getArgoApplicationName() == null) {
            return;
        }
        String appName = status.getArgoApplicationName();
        try {
            var app = client.genericKubernetesResources("argoproj.io/v1alpha1", "Application")
                    .inNamespace(argocdNamespace).withName(appName).get();
            if (app == null) {
                return;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> spec = (Map<String, Object>) app.getAdditionalProperties()
                    .computeIfAbsent("spec", k -> new java.util.HashMap<String, Object>());
            spec.put("syncPolicy", Map.of("automated", Map.of("selfHeal", !suspend, "prune", !suspend)));
            client.resource(app).inNamespace(argocdNamespace).update();
            LOG.infof("ArgoCD Application %s syncPolicy updated (suspend=%s)", appName, suspend);
        } catch (Exception e) {
            LOG.warnf("Could not update ArgoCD Application %s: %s", appName, e.getMessage());
        }
    }
}
