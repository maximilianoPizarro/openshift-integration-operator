package io.platform.operator;

import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.javaoperatorsdk.operator.api.reconciler.Context;
import io.javaoperatorsdk.operator.api.reconciler.ControllerConfiguration;
import io.javaoperatorsdk.operator.api.reconciler.Reconciler;
import io.javaoperatorsdk.operator.api.reconciler.UpdateControl;
import io.platform.api.v1alpha1.AlertingSpec;
import io.platform.api.v1alpha1.DeploymentMode;
import io.platform.api.v1alpha1.IntegrationFlow;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import io.platform.api.v1alpha1.IntegrationType;
import io.platform.api.v1alpha1.ResilienceSpec;
import io.platform.api.v1alpha1.TargetingSpec;
import io.platform.ephemeral.EphemeralCleanupService;
import io.platform.ephemeral.EphemeralResourceLabels;
import io.platform.ephemeral.EphemeralRuntimeService;
import io.platform.lifecycle.FlowLifecycleService;
import io.platform.service.ArgoService;
import io.platform.service.git.GitUrlResolver;
import io.platform.service.GitOpsService;
import io.platform.service.ScaffoldingService;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Instant;
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

    @Inject
    EphemeralRuntimeService ephemeralRuntimeService;

    @Inject
    EphemeralCleanupService ephemeralCleanupService;

    @Inject
    FlowLifecycleService flowLifecycleService;

    @Inject
    GitUrlResolver gitUrlResolver;

    @ConfigProperty(name = "sonataflow.enabled", defaultValue = "true")
    boolean sonataFlowEnabled;

    @ConfigProperty(name = "sonataflow.namespace", defaultValue = "kogito-bpm")
    String sonataFlowNamespace;

    @ConfigProperty(name = "sonataflow.cr-name-prefix", defaultValue = "iflow-")
    String sonataFlowCrPrefix;

    @ConfigProperty(name = "sonataflow.api-version", defaultValue = "sonataflow.org/v1alpha08")
    String sonataFlowApiVersion;

    @ConfigProperty(name = "ephemeral.default-ttl-seconds", defaultValue = "3600")
    int defaultTtlSeconds;

    @ConfigProperty(name = "ephemeral.max-ttl-seconds", defaultValue = "86400")
    int maxTtlSeconds;

    @ConfigProperty(name = "ephemeral.enabled", defaultValue = "true")
    boolean ephemeralEnabled;

    @Override
    public UpdateControl<IntegrationFlow> reconcile(IntegrationFlow resource,
                                                     Context<IntegrationFlow> context) {
        var spec = resource.getSpec();
        var status = resource.getStatus();

        if (status == null) {
            status = new IntegrationFlowStatus();
            resource.setStatus(status);
        }

        // Idempotency guard: skip re-scaffolding if the design hasn't changed
        String currentDesignHash = computeDesignHash(spec.getKaotoDesign());
        DeploymentMode mode = spec.getDeploymentMode();
        String desiredState = spec.getDesiredState();
        boolean lifecyclePending = desiredState != null
                && !desiredState.equals(status.getCurrentState());
        if (!lifecyclePending
                && !currentDesignHash.isEmpty()
                && currentDesignHash.equals(status.getLastScaffoldedHash())
                && status.getPhase() != null
                && (status.getPhase() == IntegrationFlowStatus.Phase.Running
                    || status.getPhase() == IntegrationFlowStatus.Phase.Building
                    || status.getPhase() == IntegrationFlowStatus.Phase.Deploying
                    || status.getPhase() == IntegrationFlowStatus.Phase.Paused
                    || status.getPhase() == IntegrationFlowStatus.Phase.Stopped
                    || (mode == DeploymentMode.EPHEMERAL && status.getPhase() != IntegrationFlowStatus.Phase.Expired))) {
            LOG.debugf("Design hash unchanged for '%s/%s', skipping reconciliation",
                    resource.getMetadata().getNamespace(), resource.getMetadata().getName());
            return UpdateControl.noUpdate();
        }

        String flowName = resource.getMetadata().getName();
        String namespace = resource.getMetadata().getNamespace();
        IntegrationType type = spec.getResolvedType();

        // Handle deletion cleanup for ephemeral flows
        if (resource.getMetadata().getDeletionTimestamp() != null
                && spec.getDeploymentMode() == DeploymentMode.EPHEMERAL) {
            ephemeralCleanupService.cleanup(flowName, namespace);
            removeFinalizer(resource, EphemeralResourceLabels.FINALIZER);
            return UpdateControl.patchResource(resource);
        }

        if (spec.getDeploymentMode() == DeploymentMode.EPHEMERAL) {
            if (!ephemeralEnabled) {
                status.setPhase(IntegrationFlowStatus.Phase.Error);
                status.setMessage("Ephemeral mode is disabled on this operator");
                finalizeStatus(resource, status);
                return UpdateControl.patchStatus(resource);
            }
            return reconcileEphemeral(resource, status, spec, type, flowName, namespace, currentDesignHash);
        }

        // GITOPS validation
        if (spec.getGitRepository() == null || spec.getGitRepository().isBlank()) {
            status.setPhase(IntegrationFlowStatus.Phase.Error);
            status.setMessage("gitRepository is required for GITOPS deployment mode");
            finalizeStatus(resource, status);
            return UpdateControl.patchStatus(resource);
        }

        LOG.infof("Reconciling IntegrationFlow '%s/%s' integrationType=%s engine=%s",
                namespace, flowName, type, spec.getEngine());

        // Handle lifecycle state changes (pause/stop/resume)
        if (desiredState != null) {
            switch (desiredState) {
                case "paused" -> {
                    if (status.getPhase() != IntegrationFlowStatus.Phase.Paused) {
                        LOG.infof("Pausing flow '%s'", flowName);
                        flowLifecycleService.apply(resource, "paused");
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
                        flowLifecycleService.apply(resource, "stopped");
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
                        flowLifecycleService.apply(resource, "running");
                        status.setPhase(IntegrationFlowStatus.Phase.Resuming);
                        status.setCurrentState("running");
                        status.setMessage("Flow resuming...");
                    }
                }
                default -> { /* proceed with normal reconciliation */ }
            }
        }

        // For SONATAFLOW, create/update the SonataFlow CR early (independent of Git/Tekton)
        if (type == IntegrationType.SONATAFLOW && sonataFlowEnabled) {
            reconcileSonataFlowCR(namespace, flowName, spec.getKaotoDesign(), status);
        }

        try {
            // Step 1: Scaffold the worker project
            status.setPhase(IntegrationFlowStatus.Phase.Scaffolding);
            var scaffoldResult = scaffoldingService.scaffold(type, spec.getKaotoDesign(), spec.getResilience());
            updateCondition(status, "Scaffolded", "True", "ScaffoldComplete", "Worker project scaffolded");

            // Step 2: Push to Git via GitOps service
            var gitResult = gitOpsService.pushScaffold(
                    gitUrlResolver.resolve(spec.getGitRepository()), spec.getBranch(), scaffoldResult);

            if (!gitResult.success()) {
                status.setPhase(IntegrationFlowStatus.Phase.Error);
                status.setMessage("Git push failed: " + gitResult.message());
                updateCondition(status, "GitPushed", "False", "PushFailed", gitResult.message());
                finalizeStatus(resource, status);
                return UpdateControl.patchStatus(resource);
            }

            status.setGitCommitHash(gitResult.commitHash());
            status.setLastScaffoldedHash(currentDesignHash);
            updateCondition(status, "GitPushed", "True", "PushComplete", gitResult.message());

            // Step 3: Trigger Tekton PipelineRun for the build
            status.setPhase(IntegrationFlowStatus.Phase.Building);
            createTektonPipelineRun(namespace, flowName,
                    gitUrlResolver.resolve(spec.getGitRepository()),
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
            String buildPhase = resolveBuildPhase(flowName, namespace);
            if ("Failed".equals(buildPhase) && !hasHealthyLocalDeployment(flowName, namespace)) {
                status.setPhase(IntegrationFlowStatus.Phase.Error);
                status.setMessage("Latest PipelineRun failed; check build logs");
                updateCondition(status, "BuildComplete", "False", "BuildFailed", "Latest Tekton build failed");
            } else if (deployments.isEmpty()) {
                status.setMessage("ApplicationSet reconciled, waiting for cluster Applications");
                status.setPhase("Failed".equals(buildPhase)
                        ? IntegrationFlowStatus.Phase.Building
                        : IntegrationFlowStatus.Phase.Deploying);
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
                Map.of("name", "git-revision", "value", commitHash),
                Map.of("name", "commit-sha", "value", commitHash),
                Map.of("name", "flow-name", "value", flowName)
        ));
        pipelineRunSpec.put("workspaces", java.util.List.of(
                Map.of("name", "shared-workspace",
                       "volumeClaimTemplate", Map.of(
                               "spec", Map.of(
                                       "accessModes", java.util.List.of("ReadWriteOnce"),
                                       "resources", Map.of(
                                               "requests", Map.of("storage", "1Gi"))))),
                Map.of("name", "basic-auth",
                       "secret", Map.of("secretName", "integration-git-basic-auth"))
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
     * Creates or updates a SonataFlow CR in the kogito-bpm namespace where the
     * OpenShift Serverless Logic operator is installed and watching.
     */
    private void reconcileSonataFlowCR(String namespace, String flowName,
                                        String kaotoDesign, IntegrationFlowStatus status) {
        String sonataFlowNs = sonataFlowNamespace;
        String sfName = sonataFlowCrPrefix + flowName;

        if (kaotoDesign == null || kaotoDesign.isBlank()) {
            LOG.warnf("No kaotoDesign provided for SonataFlow CR '%s', skipping creation", sfName);
            updateCondition(status, "SonataFlowDeployed", "False", "NoDesign",
                    "Cannot create SonataFlow CR without kaotoDesign content");
            return;
        }

        try {
            var yamlMapper = new com.fasterxml.jackson.dataformat.yaml.YAMLFactory();
            var objectMapper = new com.fasterxml.jackson.databind.ObjectMapper(yamlMapper);
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> flowSpec = objectMapper.readValue(kaotoDesign, java.util.Map.class);

            var sonataFlow = new io.fabric8.kubernetes.api.model.GenericKubernetesResourceBuilder()
                    .withApiVersion(sonataFlowApiVersion)
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
                                    "sonataflow.org/description", "Managed by Integration Platform",
                                    "sonataflow.org/version", "1.0"))
                            .build())
                    .build();

            var sfSpec = new java.util.HashMap<String, Object>();
            sfSpec.put("flow", flowSpec);

            var resources = Map.of(
                    "requests", Map.of("memory", "256Mi", "cpu", "100m"),
                    "limits", Map.of("memory", "512Mi", "cpu", "500m")
            );
            sfSpec.put("podTemplate", Map.of(
                    "container", Map.of("resources", resources)
            ));

            sonataFlow.setAdditionalProperties(Map.of("spec", sfSpec));

            kubernetesClient.resource(sonataFlow).inNamespace(sonataFlowNs).createOrReplace();
            LOG.infof("Created/updated SonataFlow CR '%s' in namespace '%s'", sfName, sonataFlowNs);

            status.setSonataFlowName(sfName);
            status.setSonataFlowNamespace(sonataFlowNs);
            updateCondition(status, "SonataFlowDeployed", "True", "CRCreated",
                    "SonataFlow CR " + sfName + " created/updated in " + sonataFlowNs);

            // Check if the SonataFlow is ready by reading back the CR status
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

        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            LOG.errorf(e, "Failed to parse kaotoDesign YAML for SonataFlow CR '%s'", sfName);
            updateCondition(status, "SonataFlowDeployed", "False", "ParseFailed",
                    "Failed to parse kaotoDesign YAML: " + e.getMessage());
        } catch (Exception e) {
            LOG.errorf(e, "Failed to reconcile SonataFlow CR for flow '%s'", flowName);
            updateCondition(status, "SonataFlowDeployed", "False", "CRFailed",
                    "Failed to create SonataFlow CR: " + e.getMessage());
        }
    }

    private String computeDesignHash(String design) {
        if (design == null || design.isBlank()) return "";
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(design.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "";
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

        var cronSpec = Map.of(
                "schedule", (Object) schedule,
                "jobTemplate", Map.of(
                        "spec", Map.of(
                                "template", Map.of("spec", podSpec))));
        cronJob.setAdditionalProperties(Map.of("spec", cronSpec));

        kubernetesClient.resource(cronJob).inNamespace(namespace).createOrReplace();
        LOG.infof("Reconciled CronJob '%s' for scheduled execution of flow '%s'", cronJobName, flowName);
    }

    private String resolveBuildPhase(String flowName, String namespace) {
        try {
            var runs = kubernetesClient.genericKubernetesResources("tekton.dev/v1", "PipelineRun")
                    .inNamespace(namespace)
                    .withLabel(EphemeralResourceLabels.LABEL_FLOW_NAME, flowName)
                    .list().getItems();
            if (runs.isEmpty()) {
                return "Unknown";
            }
            var latest = runs.stream()
                    .max(java.util.Comparator.comparing(r -> r.getMetadata().getCreationTimestamp()))
                    .orElse(null);
            if (latest == null) {
                return "Unknown";
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> statusMap = (Map<String, Object>) latest.getAdditionalProperties().get("status");
            if (statusMap == null) {
                return "Running";
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> conditions = (List<Map<String, Object>>) statusMap.get("conditions");
            if (conditions == null || conditions.isEmpty()) {
                return "Running";
            }
            Object reason = conditions.get(0).get("reason");
            return reason != null ? reason.toString() : "Unknown";
        } catch (Exception e) {
            LOG.debugf("Could not resolve build phase for %s: %s", flowName, e.getMessage());
            return "Unknown";
        }
    }

    private boolean hasHealthyLocalDeployment(String flowName, String namespace) {
        var dep = kubernetesClient.apps().deployments()
                .inNamespace(namespace).withName(sonataFlowCrPrefix + flowName).get();
        return dep != null && dep.getStatus() != null
                && dep.getStatus().getReadyReplicas() != null
                && dep.getStatus().getReadyReplicas() > 0;
    }

    private UpdateControl<IntegrationFlow> reconcileEphemeral(IntegrationFlow resource,
            IntegrationFlowStatus status,
            io.platform.api.v1alpha1.IntegrationFlowSpec spec,
            IntegrationType type,
            String flowName,
            String namespace,
            String currentDesignHash) {

        LOG.infof("Reconciling ephemeral IntegrationFlow '%s/%s' type=%s", namespace, flowName, type);
        status.setDeploymentMode(DeploymentMode.EPHEMERAL);
        ensureFinalizer(resource, EphemeralResourceLabels.FINALIZER);

        String desiredState = spec.getDesiredState();
        if ("paused".equals(desiredState) || "stopped".equals(desiredState)) {
            flowLifecycleService.apply(resource, desiredState);
            status.setPhase("paused".equals(desiredState)
                    ? IntegrationFlowStatus.Phase.Paused : IntegrationFlowStatus.Phase.Stopped);
            status.setCurrentState(desiredState);
            status.setMessage("Ephemeral flow " + desiredState + " by user");
            finalizeStatus(resource, status);
            return UpdateControl.patchStatus(resource);
        }
        if ("running".equals(desiredState) && status.getEphemeralWorkerRef() != null
                && (status.getPhase() == IntegrationFlowStatus.Phase.Paused
                || status.getPhase() == IntegrationFlowStatus.Phase.Stopped)) {
            flowLifecycleService.apply(resource, "running");
        }

        if (spec.getKaotoDesign() == null || spec.getKaotoDesign().isBlank()) {
            status.setPhase(IntegrationFlowStatus.Phase.Error);
            status.setMessage("kaotoDesign is required for ephemeral deployment");
            finalizeStatus(resource, status);
            return UpdateControl.patchStatus(resource);
        }

        int ttl = resolveTtlSeconds(spec);
        Instant expiresAt = resolveExpiresAt(resource, status, ttl);
        if (Instant.now().isAfter(expiresAt)) {
            handleExpiredEphemeral(flowName, namespace, status);
            finalizeStatus(resource, status);
            return UpdateControl.patchStatus(resource);
        }

        status.setEphemeralExpiresAt(expiresAt.toString());

        try {
            status.setPhase(IntegrationFlowStatus.Phase.Building);
            var scaffoldResult = scaffoldingService.scaffold(type, spec.getKaotoDesign(), spec.getResilience());
            updateCondition(status, "Scaffolded", "True", "ScaffoldComplete", "Ephemeral worker scaffolded");

            var deployResult = ephemeralRuntimeService.deploy(
                    type, flowName, namespace, scaffoldResult, spec, status);

            status.setEphemeralWorkerRef(deployResult.workerRef());
            status.setLastScaffoldedHash(currentDesignHash);
            updateCondition(status, "EphemeralDeployed", "True", "Deployed", deployResult.message());

            if (type == IntegrationType.SONATAFLOW) {
                status.setPhase("True".equals(status.getSonataFlowReady())
                        ? IntegrationFlowStatus.Phase.Running
                        : IntegrationFlowStatus.Phase.Building);
            } else {
                status.setPhase(IntegrationFlowStatus.Phase.Running);
            }
            status.setCurrentState("running");
            status.setMessage("Ephemeral flow running (expires " + expiresAt + ")");

        } catch (Exception e) {
            LOG.errorf(e, "Ephemeral reconciliation failed for %s", flowName);
            status.setPhase(IntegrationFlowStatus.Phase.Error);
            status.setMessage("Ephemeral deployment failed: " + e.getMessage());
            updateCondition(status, "EphemeralDeployed", "False", "DeployFailed", e.getMessage());
        }

        finalizeStatus(resource, status);
        return UpdateControl.patchStatus(resource);
    }

    private int resolveTtlSeconds(io.platform.api.v1alpha1.IntegrationFlowSpec spec) {
        if (spec.getEphemeral() != null && spec.getEphemeral().getTtlSeconds() != null) {
            return Math.min(spec.getEphemeral().getTtlSeconds(), maxTtlSeconds);
        }
        return defaultTtlSeconds;
    }

    private Instant resolveExpiresAt(IntegrationFlow resource, IntegrationFlowStatus status, int ttlSeconds) {
        if (status.getEphemeralExpiresAt() != null && !status.getEphemeralExpiresAt().isBlank()) {
            try {
                return Instant.parse(status.getEphemeralExpiresAt());
            } catch (Exception ignored) {
                // fall through
            }
        }
        var annotations = resource.getMetadata().getAnnotations();
        if (annotations != null && annotations.containsKey(EphemeralResourceLabels.ANNOTATION_EXPIRES_AT)) {
            try {
                return Instant.parse(annotations.get(EphemeralResourceLabels.ANNOTATION_EXPIRES_AT));
            } catch (Exception ignored) {
                // fall through
            }
        }
        return Instant.now().plusSeconds(ttlSeconds);
    }

    private void annotateExpiry(IntegrationFlow resource, Instant expiresAt) {
        var metadata = resource.getMetadata();
        var annotations = metadata.getAnnotations();
        if (annotations == null) {
            annotations = new java.util.HashMap<>();
            metadata.setAnnotations(annotations);
        }
        annotations.put(EphemeralResourceLabels.ANNOTATION_EXPIRES_AT, expiresAt.toString());
    }

    private void handleExpiredEphemeral(String flowName, String namespace, IntegrationFlowStatus status) {
        status.setPhase(IntegrationFlowStatus.Phase.Expired);
        status.setMessage("Ephemeral flow expired; scaled down");
        updateCondition(status, "EphemeralExpired", "True", "TTLExpired", "Flow TTL reached");

        try {
            var deployments = kubernetesClient.apps().deployments().inNamespace(namespace)
                    .withLabel(EphemeralResourceLabels.LABEL_FLOW_NAME, flowName)
                    .list().getItems();
            for (var deployment : deployments) {
                deployment.getSpec().setReplicas(0);
                kubernetesClient.apps().deployments().inNamespace(namespace)
                        .resource(deployment).update();
            }
        } catch (Exception e) {
            LOG.warnf("Could not scale down ephemeral deployment for %s: %s", flowName, e.getMessage());
        }
    }

    private void ensureFinalizer(IntegrationFlow resource, String finalizer) {
        var finalizers = resource.getMetadata().getFinalizers();
        if (finalizers == null) {
            finalizers = new ArrayList<>();
            resource.getMetadata().setFinalizers(finalizers);
        }
        if (!finalizers.contains(finalizer)) {
            finalizers.add(finalizer);
        }
    }

    private void removeFinalizer(IntegrationFlow resource, String finalizer) {
        var finalizers = resource.getMetadata().getFinalizers();
        if (finalizers != null) {
            finalizers.remove(finalizer);
        }
    }
}
