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

            // Step 5: For SONATAFLOW, create/update the SonataFlow CR in the platform namespace
            if (type == IntegrationType.SONATAFLOW) {
                reconcileSonataFlowCR(namespace, flowName, spec.getKaotoDesign(), status);
            }

            // Step 7: Create PrometheusRule for alerting (if enabled)
            if (spec.getAlerting() != null && spec.getAlerting().isEnabled()) {
                reconcilePrometheusRule(namespace, flowName, spec.getAlerting());
                status.setPrometheusRuleName("iflow-" + flowName + "-alerts");
            }

            // Step 8: Create CronJob for scheduled execution (if configured)
            if (spec.getSchedule() != null && !spec.getSchedule().isBlank()) {
                reconcileSchedule(namespace, flowName, spec.getSchedule());
            }

            // Step 9: Final status update
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

    /**
     * Creates or updates a SonataFlow CR in the kogito-bpm namespace so the
     * OpenShift Serverless Logic operator picks it up and shows it in the
     * SonataFlow Management Console.
     */
    private void reconcileSonataFlowCR(String namespace, String flowName,
                                        String kaotoDesign, IntegrationFlowStatus status) {
        String sonataFlowNs = "kogito-bpm";
        String sfName = "iflow-" + flowName;

        try {
            // Parse the kaotoDesign YAML to extract the flow spec.
            // The kaotoDesign is a Serverless Workflow YAML; the SonataFlow CR
            // wraps it under spec.flow with the parsed structure.
            // We store it as a raw JSON map so the Fabric8 generic resource handles serialisation.
            var yamlMapper = new com.fasterxml.jackson.dataformat.yaml.YAMLFactory();
            var objectMapper = new com.fasterxml.jackson.databind.ObjectMapper(yamlMapper);
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> flowSpec = objectMapper.readValue(
                    kaotoDesign != null ? kaotoDesign : "{}", java.util.Map.class);

            var sonataFlow = new io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder()
                    .withApiVersion("sonataflow.org/v1alpha08")
                    .withKind("SonataFlow")
                    .withMetadata(new ObjectMetaBuilder()
                            .withName(sfName)
                            .withNamespace(sonataFlowNs)
                            .withLabels(Map.of(
                                    "app", sfName,
                                    "app.kubernetes.io/part-of", "integration-platform",
                                    "platform.io/flow-name", flowName,
                                    "app.openshift.io/runtime", "kogito"))
                            .withAnnotations(Map.of(
                                    "sonataflow.org/profile", "preview",
                                    "sonataflow.org/version", "1.0.0",
                                    "sonataflow.org/description",
                                    "Managed by IntegrationFlow operator - " + flowName))
                            .build())
                    .build();

            var sfSpec = new java.util.HashMap<String, Object>();
            sfSpec.put("flow", flowSpec);

            // Pod template with data-index/jobs-service env vars
            var envVars = java.util.List.of(
                    Map.of("name", "KOGITO_DATAINDEX_URL",
                           "value", "http://sonataflow-data-index-http.kogito-bpm.svc.cluster.local:8080"),
                    Map.of("name", "KOGITO_JOBSERVICE_URL",
                           "value", "http://sonataflow-jobs-http.kogito-bpm.svc.cluster.local:8080")
            );
            sfSpec.put("podTemplate", Map.of(
                    "container", Map.of("env", envVars, "resources", Map.of())
            ));

            sonataFlow.setAdditionalProperties(Map.of("spec", sfSpec));
            kubernetesClient.resource(sonataFlow).inNamespace(sonataFlowNs).createOrReplace();

            status.setSonataFlowName(sfName);
            status.setSonataFlowNamespace(sonataFlowNs);
            updateCondition(status, "SonataFlowDeployed", "True", "CRCreated",
                    "SonataFlow CR " + sfName + " created/updated in " + sonataFlowNs);

            // Check if the SonataFlow is ready
            try {
                var existing = kubernetesClient.genericKubernetesResources(
                        "sonataflow.org/v1alpha08", "SonataFlow")
                        .inNamespace(sonataFlowNs).withName(sfName).get();
                if (existing != null) {
                    @SuppressWarnings("unchecked")
                    var sfStatus = (java.util.Map<String, Object>) existing.getAdditionalProperties().get("status");
                    if (sfStatus != null) {
                        @SuppressWarnings("unchecked")
                        var conditions = (java.util.List<java.util.Map<String, Object>>) sfStatus.get("conditions");
                        if (conditions != null) {
                            var readyCond = conditions.stream()
                                    .filter(c -> "Ready".equals(c.get("type")))
                                    .findFirst();
                            readyCond.ifPresent(c -> status.setSonataFlowReady(String.valueOf(c.get("status"))));
                        }
                    }
                }
            } catch (Exception e) {
                LOG.warnf("Could not read SonataFlow status for %s: %s", sfName, e.getMessage());
            }

            LOG.infof("Reconciled SonataFlow CR '%s' in namespace '%s'", sfName, sonataFlowNs);

        } catch (Exception e) {
            LOG.errorf(e, "Failed to reconcile SonataFlow CR for flow '%s'", flowName);
            updateCondition(status, "SonataFlowDeployed", "False", "CRFailed",
                    "Failed to create SonataFlow CR: " + e.getMessage());
        }
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

        var container = new java.util.HashMap<String, Object>();
        container.put("name", "trigger");
        container.put("image", "bitnami/kubectl:latest");
        container.put("command", java.util.List.of("kubectl"));
        container.put("args", java.util.List.of(
                "patch", "integrationflow", flowName,
                "-n", namespace, "--type=merge",
                "-p", "{\"spec\":{\"desiredState\":\"running\"}}"));

        var podSpec = new java.util.HashMap<String, Object>();
        podSpec.put("serviceAccountName", "integration-operator-sa");
        podSpec.put("restartPolicy", "OnFailure");
        podSpec.put("containers", java.util.List.of(container));

        var spec = Map.of(
                "schedule", (Object) schedule,
                "jobTemplate", Map.of(
                        "spec", Map.of(
                                "template", Map.of("spec", podSpec))));
        cronJob.setAdditionalProperties(Map.of("spec", spec));

        kubernetesClient.resource(cronJob).inNamespace(namespace).createOrReplace();
        LOG.infof("Reconciled CronJob '%s' for scheduled execution of flow '%s'", cronJobName, flowName);
    }
}
