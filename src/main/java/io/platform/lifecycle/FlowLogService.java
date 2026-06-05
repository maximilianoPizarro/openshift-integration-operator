package io.platform.lifecycle;

import io.fabric8.kubernetes.api.model.ContainerStatus;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.api.v1alpha1.DeploymentMode;
import io.platform.api.v1alpha1.IntegrationFlow;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import io.platform.api.v1alpha1.IntegrationType;
import io.platform.ephemeral.EphemeralResourceLabels;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@ApplicationScoped
public class FlowLogService {

    @Inject
    KubernetesClient client;

    @ConfigProperty(name = "platform.namespace", defaultValue = "openshift-integration")
    String platformNamespace;

    @ConfigProperty(name = "sonataflow.namespace", defaultValue = "kogito-bpm")
    String sonataFlowNamespace;

    @ConfigProperty(name = "sonataflow.cr-name-prefix", defaultValue = "iflow-")
    String sonataFlowCrPrefix;

    public record PodRef(String namespace, String podName, String container) {}

    public record FlowLogs(PodRef pod, String logs, String timestamp, List<String> containers) {}

    public Optional<PodRef> resolveRuntimePod(IntegrationFlow flow) {
        if (flow == null || flow.getMetadata() == null) {
            return Optional.empty();
        }
        String flowName = flow.getMetadata().getName();
        IntegrationFlowStatus status = flow.getStatus();
        var spec = flow.getSpec();

        if (spec != null && spec.getDeploymentMode() == DeploymentMode.EPHEMERAL) {
            return resolveFromWorkerRef(status != null ? status.getEphemeralWorkerRef() : null, platformNamespace);
        }

        IntegrationType type = spec != null ? spec.getResolvedType() : IntegrationType.CAMEL_ROUTE;
        if (type == IntegrationType.SONATAFLOW) {
            String sfNs = status != null && status.getSonataFlowNamespace() != null
                    ? status.getSonataFlowNamespace() : sonataFlowNamespace;
            String deployName = status != null && status.getSonataFlowName() != null
                    ? status.getSonataFlowName() : sonataFlowCrPrefix + flowName;
            return resolveFromDeployment(sfNs, deployName);
        }

        Optional<PodRef> local = findRunningWorkerPod(platformNamespace, flowName);
        if (local.isPresent()) {
            return local;
        }
        String sfNs = status != null ? status.getSonataFlowNamespace() : null;
        String sfName = status != null ? status.getSonataFlowName() : null;
        if (sfNs != null && sfName != null) {
            return resolveFromDeployment(sfNs, sfName);
        }
        return Optional.empty();
    }

    public FlowLogs fetchLogs(IntegrationFlow flow, int tailLines, String container) throws Exception {
        PodRef podRef = resolveRuntimePod(flow)
                .orElseThrow(() -> new IllegalStateException("No running worker pod found for this flow"));
        List<String> containers = listContainers(podRef.namespace(), podRef.podName());
        String selected = container != null && !container.isBlank()
                ? container
                : containers.isEmpty() ? null : containers.get(0);
        String logs = client.pods()
                .inNamespace(podRef.namespace())
                .withName(podRef.podName())
                .inContainer(selected)
                .tailingLines(tailLines > 0 ? tailLines : 500)
                .getLog();
        return new FlowLogs(podRef, logs != null ? logs : "", java.time.Instant.now().toString(), containers);
    }

    public Map<String, Object> listResources(IntegrationFlow flow) {
        String flowName = flow.getMetadata().getName();
        var runtime = listRuntimePods(flowName);
        var build = client.pods().inNamespace(platformNamespace)
                .withLabel(EphemeralResourceLabels.LABEL_FLOW_NAME, flowName)
                .withLabel(EphemeralResourceLabels.LABEL_COMPONENT, "build")
                .list().getItems().stream()
                .map(this::toPodSummary)
                .toList();
        return Map.of(
                "name", flowName,
                "runtimePods", runtime,
                "buildPods", build
        );
    }

    private List<Map<String, String>> listRuntimePods(String flowName) {
        return client.pods().inNamespace(platformNamespace)
                .withLabel(EphemeralResourceLabels.LABEL_FLOW_NAME, flowName)
                .list().getItems().stream()
                .filter(this::isRuntimePod)
                .map(this::toPodSummary)
                .toList();
    }

    private Map<String, String> toPodSummary(Pod pod) {
        return Map.of(
                "name", pod.getMetadata().getName(),
                "namespace", pod.getMetadata().getNamespace(),
                "phase", pod.getStatus() != null ? pod.getStatus().getPhase() : "Unknown"
        );
    }

    private Optional<PodRef> resolveFromWorkerRef(String workerRef, String defaultNs) {
        if (workerRef == null || workerRef.isBlank()) {
            return Optional.empty();
        }
        String deployName = workerRef;
        String ns = defaultNs;
        if (workerRef.contains("/")) {
            String[] parts = workerRef.split("/", 2);
            if ("deployment".equalsIgnoreCase(parts[0])) {
                deployName = parts[1];
            }
        }
        return resolveFromDeployment(ns, deployName);
    }

    private Optional<PodRef> resolveFromDeployment(String namespace, String deploymentName) {
        var pods = client.pods().inNamespace(namespace)
                .withLabel("app", deploymentName)
                .list().getItems();
        if (pods.isEmpty()) {
            pods = client.apps().deployments().inNamespace(namespace).withName(deploymentName).get() != null
                    ? client.pods().inNamespace(namespace).list().getItems().stream()
                    .filter(p -> p.getMetadata().getName().startsWith(deploymentName))
                    .filter(this::isRuntimePod)
                    .toList()
                    : List.of();
        }
        return pods.stream()
                .filter(this::isRuntimePod)
                .max(Comparator.comparing(p -> p.getMetadata().getCreationTimestamp()))
                .map(p -> new PodRef(namespace, p.getMetadata().getName(), firstReadyContainer(p)));
    }

    private Optional<PodRef> findRunningWorkerPod(String namespace, String flowName) {
        return client.pods().inNamespace(namespace)
                .withLabel(EphemeralResourceLabels.LABEL_FLOW_NAME, flowName)
                .list().getItems().stream()
                .filter(this::isRuntimePod)
                .max(Comparator.comparing(p -> p.getMetadata().getCreationTimestamp()))
                .map(p -> new PodRef(namespace, p.getMetadata().getName(), firstReadyContainer(p)));
    }

    private boolean isRuntimePod(Pod pod) {
        if (pod.getMetadata() == null || pod.getStatus() == null) {
            return false;
        }
        String name = pod.getMetadata().getName();
        if (name.contains("fetch-source") || name.contains("build-maven") || name.contains("-build-")) {
            return false;
        }
        var labels = pod.getMetadata().getLabels();
        if (labels != null) {
            if ("build".equals(labels.get(EphemeralResourceLabels.LABEL_COMPONENT))) {
                return false;
            }
            if (labels.containsKey("tekton.dev/pipelineRun") || labels.containsKey("tekton.dev/taskRun")) {
                return false;
            }
        }
        return "Running".equals(pod.getStatus().getPhase());
    }

    private String firstReadyContainer(Pod pod) {
        if (pod.getStatus() == null || pod.getStatus().getContainerStatuses() == null) {
            return null;
        }
        return pod.getStatus().getContainerStatuses().stream()
                .filter(ContainerStatus::getReady)
                .map(ContainerStatus::getName)
                .findFirst()
                .orElse(pod.getStatus().getContainerStatuses().get(0).getName());
    }

    private List<String> listContainers(String namespace, String podName) {
        Pod pod = client.pods().inNamespace(namespace).withName(podName).get();
        if (pod == null || pod.getSpec() == null || pod.getSpec().getContainers() == null) {
            return List.of();
        }
        return pod.getSpec().getContainers().stream()
                .map(c -> c.getName())
                .toList();
    }
}
