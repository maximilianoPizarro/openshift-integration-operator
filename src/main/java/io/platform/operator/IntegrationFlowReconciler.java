package io.platform.operator;

import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.javaoperatorsdk.operator.api.reconciler.Context;
import io.javaoperatorsdk.operator.api.reconciler.ControllerConfiguration;
import io.javaoperatorsdk.operator.api.reconciler.Reconciler;
import io.javaoperatorsdk.operator.api.reconciler.UpdateControl;
import io.platform.api.v1alpha1.AlertingSpec;
import io.platform.api.v1alpha1.IntegrationFlow;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import io.platform.api.v1alpha1.IntegrationType;
import io.platform.api.v1alpha1.ResilienceSpec;
import io.platform.api.v1alpha1.TargetingSpec;
import io.platform.service.ArgoService;
import io.platform.service.GitOpsService;
import io.platform.service.ScaffoldingService;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@ControllerConfiguration
public class IntegrationFlowReconciler implements Reconciler<IntegrationFlow> {

    private static final Logger LOG = Logger.getLogger(IntegrationFlowReconciler.class);
    private static final String GIT_MANIFEST_PATH = "base";

    @Inject
    KubernetesClient kubernetesClient;

    @Inject
    ScaffoldingService scaffoldingService;

    @Inject
    GitOpsService gitOpsService;

    @Inject
    ArgoService argoService;

    @Override
    public UpdateControl<IntegrationFlow> reconcile(IntegrationFlow resource,
                                                     Context<IntegrationFlow> context) {
        var spec = resource.getSpec();
        var status = resource.getStatus();

        if (status == null) {
            status = new IntegrationFlowStatus();
            resource.setStatus(status);
        }

        String flowName = resource.getMetadata().getName();
        String namespace = resource.getMetadata().getNamespace();
        IntegrationType type = spec.getResolvedType();
        LOG.infof("Reconciling IntegrationFlow '%s/%s' integrationType=%s engine=%s",
                namespace, flowName, type, spec.getEngine());

        // Handle lifecycle state changes (pause/stop/resume)
        String desiredState = spec.getDesiredState();
        if (desiredState != null) {
            switch (desiredState) {
                case "paused" -> {
                    if (status.getPhase() != IntegrationFlowStatus.Phase.Paused) {
                        LOG.infof("Pausing flow '%s'", flowName);
                        status.setPhase(IntegrationFlowStatus.Phase.Paused);
                        status.setCurrentState("paused");
                        status.setMessage("Flow paused by user");
                        finalizeStatus(resource, status);
                        return UpdateControl.patchStatus(resource);
                    }
                    return UpdateControl.noUpdate();
                }
                case "stopped" -> {
                    if (status.getPhase() != IntegrationFlowStatus.Phase.Stopped) {
                        LOG.infof("Stopping flow '%s'", flowName);
                        status.setPhase(IntegrationFlowStatus.Phase.Stopped);
                        status.setCurrentState("stopped");
                        status.setMessage("Flow stopped by user");
                        finalizeStatus(resource, status);
                        return UpdateControl.patchStatus(resource);
                    }
                    return UpdateControl.noUpdate();
                }
                case "running" -> {
                    if (status.getPhase() == IntegrationFlowStatus.Phase.Paused
                            || status.getPhase() == IntegrationFlowStatus.Phase.Stopped) {
                        LOG.infof("Resuming flow '%s'", flowName);
                        status.setPhase(IntegrationFlowStatus.Phase.Resuming);
                        status.setCurrentState("running");
                        status.setMessage("Flow resuming...");
                    }
                }
                default -> { /* proceed with normal reconciliation */ }
            }
        }

        try {
            // Step 1: Scaffold the worker project
            status.setPhase(IntegrationFlowStatus.Phase.Scaffolding);
            var scaffoldResult = scaffoldingService.scaffold(type, spec.getKaotoDesign(), spec.getResilience());
            updateCondition(status, "Scaffolded", "True", "ScaffoldComplete", "Worker project scaffolded");

            // Step 2: Push to Git via GitOps service
            var gitResult = gitOpsService.pushScaffold(
                    spec.getGitRepository(), spec.getBranch(), scaffoldResult);

            if (!gitResult.success()) {
                status.setPhase(IntegrationFlowStatus.Phase.Error);
                status.setMessage("Git push failed: " + gitResult.message());
                updateCondition(status, "GitPushed", "False", "PushFailed", gitResult.message());
                finalizeStatus(resource, status);
                return UpdateControl.patchStatus(resource);
            }

            status.setGitCommitHash(gitResult.commitHash());
            updateCondition(status, "GitPushed", "True", "PushComplete", gitResult.message());

            // Step 3: Trigger Tekton PipelineRun for the build
            status.setPhase(IntegrationFlowStatus.Phase.Building);
            createTektonPipelineRun(namespace, flowName, spec.getGitRepository(),
                    spec.getBranch(), gitResult.commitHash());

            // Step 4: Reconcile ArgoCD ApplicationSet for multi-cluster deployment
            status.setPhase(IntegrationFlowStatus.Phase.Deploying);
            Map<String, String> clusterSelector = resolveClusterSelector(spec.getTargeting());
            List<String> excludeClusters = resolveExcludeClusters(spec.getTargeting());

            argoService.reconcileApplicationSet(
                    flowName,
                    namespace,
                    spec.getGitRepository(),
                    spec.getBranch(),
                    GIT_MANIFEST_PATH,
                    clusterSelector,
                    excludeClusters);

            String appSetName = flowName + "-appset";
            status.setApplicationSetName(appSetName);
            status.setArgoApplicationName("iflow-" + flowName);

            List<IntegrationFlowStatus.ClusterDeployment> deployments =
                    argoService.getClusterDeployments(appSetName);
            status.setClusterDeployments(deployments);
            updateCondition(status, "ApplicationSetReady", "True", "Reconciled",
                    "ApplicationSet " + appSetName + " reconciled");

            // Step 5: Create PrometheusRule for alerting (if enabled)
            if (spec.getAlerting() != null && spec.getAlerting().isEnabled()) {
                reconcilePrometheusRule(namespace, flowName, spec.getAlerting());
                status.setPrometheusRuleName("iflow-" + flowName + "-alerts");
            }

            // Step 6: Create CronJob for scheduled execution (if configured)
            if (spec.getSchedule() != null && !spec.getSchedule().isBlank()) {
                reconcileSchedule(namespace, flowName, spec.getSchedule());
            }

            // Step 7: Final status update
            status.setCurrentState("running");
            if (deployments.isEmpty()) {
                status.setMessage("ApplicationSet reconciled, waiting for cluster Applications");
            } else {
                status.setMessage("ApplicationSet reconciled, tracking "
                        + deployments.size() + " cluster deployment(s)");
                status.setPhase(resolvePhaseFromDeployments(deployments));
            }

        } catch (Exception e) {
            LOG.errorf(e, "Error reconciling IntegrationFlow '%s'", flowName);
            status.setPhase(IntegrationFlowStatus.Phase.Error);
            status.setMessage("Reconciliation failed: " + e.getMessage());
        }

        finalizeStatus(resource, status);
        return UpdateControl.patchStatus(resource);
    }

    private void finalizeStatus(IntegrationFlow resource, IntegrationFlowStatus status) {
        if (resource.getMetadata().getGeneration() != null) {
            status.setObservedGeneration(resource.getMetadata().getGeneration());
        }
        status.setLastReconciledAt(java.time.Instant.now().toString());
    }

    private Map<String, String> resolveClusterSelector(TargetingSpec targeting) {
        if (targeting == null) {
            return Collections.emptyMap();
        }

        return switch (targeting.getStrategy()) {
            case selector -> targeting.getClusterSelector() != null
                    ? targeting.getClusterSelector()
                    : Collections.emptyMap();
            case all -> Collections.emptyMap();
            case explicit -> {
                if (targeting.getClusterSelector() != null && !targeting.getClusterSelector().isEmpty()) {
                    yield targeting.getClusterSelector();
                }
                yield Collections.emptyMap();
            }
        };
    }

    private List<String> resolveExcludeClusters(TargetingSpec targeting) {
        if (targeting == null || targeting.getExcludeClusters() == null) {
            return List.of();
        }
        return targeting.getExcludeClusters().stream()
                .map(TargetingSpec.ClusterExclusion::getName)
                .filter(name -> name != null && !name.isBlank())
                .collect(Collectors.toList());
    }

    private IntegrationFlowStatus.Phase resolvePhaseFromDeployments(
            List<IntegrationFlowStatus.ClusterDeployment> deployments) {
        boolean anyUnhealthy = deployments.stream()
                .anyMatch(d -> !"Healthy".equals(d.getHealthStatus()));
        boolean allHealthy = deployments.stream()
                .allMatch(d -> "Healthy".equals(d.getHealthStatus()));

        if (allHealthy) {
            return IntegrationFlowStatus.Phase.Running;
        }
        if (anyUnhealthy) {
            return IntegrationFlowStatus.Phase.PartiallyHealthy;
        }
        return IntegrationFlowStatus.Phase.Deploying;
    }

    private void updateCondition(IntegrationFlowStatus status, String type, String conditionStatus,
                                   String reason, String message) {
        List<IntegrationFlowStatus.Condition> conditions = status.getConditions();
        if (conditions == null) {
            conditions = new ArrayList<>();
            status.setConditions(conditions);
        }

        for (IntegrationFlowStatus.Condition condition : conditions) {
            if (type.equals(condition.getType())) {
                condition.setStatus(conditionStatus);
                condition.setReason(reason);
                condition.setMessage(message);
                condition.setLastTransitionTime(java.time.Instant.now().toString());
                return;
            }
        }

        conditions.add(new IntegrationFlowStatus.Condition(type, conditionStatus, reason, message));
    }

    /**
     * Creates a Tekton PipelineRun using the Fabric8 client's generic resource API.
     * The PipelineRun references a cluster Pipeline named "integration-flow-build"
     * that must be pre-installed (via Helm chart or cluster bootstrap).
     */
    private void createTektonPipelineRun(String namespace, String flowName,
                                          String gitRepo, String branch, String commitHash) {
        var pipelineRun = new io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder()
                .withApiVersion("tekton.dev/v1")
                .withKind("PipelineRun")
                .withMetadata(new ObjectMetaBuilder()
                        .withGenerateName("iflow-build-" + flowName + "-")
                        .withNamespace(namespace)
                        .withLabels(Map.of(
                                "platform.io/flow-name", flowName,
                                "platform.io/component", "build"))
                        .build())
                .build();

        var pipelineRunSpec = new java.util.HashMap<String, Object>();
        pipelineRunSpec.put("pipelineRef", Map.of("name", "integration-flow-build"));
        pipelineRunSpec.put("params", java.util.List.of(
                Map.of("name", "git-url", "value", gitRepo),
                Map.of("name", "git-revision", "value", branch),
                Map.of("name", "commit-sha", "value", commitHash),
                Map.of("name", "flow-name", "value", flowName)
        ));
        pipelineRunSpec.put("workspaces", java.util.List.of(
                Map.of("name", "shared-workspace",
                       "volumeClaimTemplate", Map.of(
                               "spec", Map.of(
                                       "accessModes", java.util.List.of("ReadWriteOnce"),
                                       "resources", Map.of(
                                               "requests", Map.of("storage", "1Gi")))))
        ));
        pipelineRun.setAdditionalProperties(Map.of("spec", pipelineRunSpec));

        kubernetesClient.resource(pipelineRun).inNamespace(namespace).create();
        LOG.infof("Created PipelineRun for flow '%s' in namespace '%s'", flowName, namespace);
    }

    private void reconcilePrometheusRule(String namespace, String flowName,
                                          io.platform.api.v1alpha1.AlertingSpec alerting) {
        String ruleName = "iflow-" + flowName + "-alerts";
        double threshold = alerting.getErrorRateThreshold() != null ? alerting.getErrorRateThreshold() : 0.05;

        var rule = new io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder()
                .withApiVersion("monitoring.coreos.com/v1")
                .withKind("PrometheusRule")
                .withMetadata(new ObjectMetaBuilder()
                        .withName(ruleName)
                        .withNamespace(namespace)
                        .withLabels(Map.of(
                                "platform.io/flow-name", flowName,
                                "platform.io/component", "alerting",
                                "app.kubernetes.io/part-of", "integration-platform"))
                        .build())
                .build();

        var ruleSpec = Map.of("groups", java.util.List.of(Map.of(
                "name", flowName + ".rules",
                "rules", java.util.List.of(
                        Map.of("alert", "IntegrationFlowHighErrorRate",
                                "expr", String.format(
                                        "rate(camel_exchanges_failed_total{flow_name=\"%s\"}[5m]) / rate(camel_exchanges_total{flow_name=\"%s\"}[5m]) > %f",
                                        flowName, flowName, threshold),
                                "for", "2m",
                                "labels", Map.of("severity", "warning", "flow_name", flowName),
                                "annotations", Map.of(
                                        "summary", "IntegrationFlow " + flowName + " error rate above " + (threshold * 100) + "%",
                                        "description", "Flow {{ $labels.flow_name }} has error rate {{ $value | humanizePercentage }} over the last 5 minutes.")),
                        Map.of("alert", "IntegrationFlowDown",
                                "expr", String.format("absent(up{job=\"%s\"})", flowName),
                                "for", "5m",
                                "labels", Map.of("severity", "critical", "flow_name", flowName),
                                "annotations", Map.of(
                                        "summary", "IntegrationFlow " + flowName + " is down",
                                        "description", "No metrics received from flow {{ $labels.flow_name }} for 5 minutes.")))
        )));
        rule.setAdditionalProperties(Map.of("spec", ruleSpec));

        kubernetesClient.resource(rule).inNamespace(namespace).createOrReplace();
        LOG.infof("Reconciled PrometheusRule '%s' for flow '%s'", ruleName, flowName);
    }

    private void reconcileSchedule(String namespace, String flowName, String schedule) {
        String cronJobName = "iflow-schedule-" + flowName;

        var cronJob = new io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder()
                .withApiVersion("batch/v1")
                .withKind("CronJob")
                .withMetadata(new ObjectMetaBuilder()
                        .withName(cronJobName)
                        .withNamespace(namespace)
                        .withLabels(Map.of(
                                "platform.io/flow-name", flowName,
                                "platform.io/component", "scheduler"))
                        .build())
                .build();

        var spec = Map.of(
                "schedule", schedule,
                "jobTemplate", Map.of(
                        "spec", Map.of(
                                "template", Map.of(
                                        "spec", Map.of(
                                                "serviceAccountName", "integration-operator-sa",
                                                "restartPolicy", "OnFailure",
                                                "containers", java.util.List.of(Map.of(
                                                        "name", "trigger",
                                                        "image", "bitnami/kubectl:latest",
                                                        "command", java.util.List.of("kubectl"),
                                                        "args", java.util.List.of(
                                                                "patch", "integrationflow", flowName,
                                                                "-n", namespace,
                                                                "--type=merge",
                                                                "-p", "{\"spec\":{\"desiredState\":\"running\"}}")
                                                ))))
                ));
        cronJob.setAdditionalProperties(Map.of("spec", spec));

        kubernetesClient.resource(cronJob).inNamespace(namespace).createOrReplace();
        LOG.infof("Reconciled CronJob '%s' for scheduled execution of flow '%s'", cronJobName, flowName);
    }
}
