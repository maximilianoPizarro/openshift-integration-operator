package io.platform.operator;

import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.javaoperatorsdk.operator.api.reconciler.Context;
import io.javaoperatorsdk.operator.api.reconciler.ControllerConfiguration;
import io.javaoperatorsdk.operator.api.reconciler.Reconciler;
import io.javaoperatorsdk.operator.api.reconciler.UpdateControl;
import io.platform.api.v1alpha1.IntegrationFlow;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import io.platform.service.GitOpsService;
import io.platform.service.ScaffoldingService;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Map;

@ControllerConfiguration
public class IntegrationFlowReconciler implements Reconciler<IntegrationFlow> {

    private static final Logger LOG = Logger.getLogger(IntegrationFlowReconciler.class);

    @Inject
    KubernetesClient kubernetesClient;

    @Inject
    ScaffoldingService scaffoldingService;

    @Inject
    GitOpsService gitOpsService;

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
        LOG.infof("Reconciling IntegrationFlow '%s/%s' engine=%s", namespace, flowName, spec.getEngine());

        try {
            // Step 1: Scaffold the worker project
            status.setPhase(IntegrationFlowStatus.Phase.Scaffolding);
            var scaffoldResult = scaffoldingService.scaffold(spec.getEngine(), spec.getKaotoDesign());

            // Step 2: Push to Git via GitOps service
            var gitResult = gitOpsService.pushScaffold(
                    spec.getGitRepository(), spec.getBranch(), scaffoldResult);

            if (!gitResult.success()) {
                status.setPhase(IntegrationFlowStatus.Phase.Error);
                status.setMessage("Git push failed: " + gitResult.message());
                return UpdateControl.patchStatus(resource);
            }

            status.setGitCommitHash(gitResult.commitHash());

            // Step 3: Trigger Tekton PipelineRun for the build
            status.setPhase(IntegrationFlowStatus.Phase.Building);
            createTektonPipelineRun(namespace, flowName, spec.getGitRepository(),
                    spec.getBranch(), gitResult.commitHash());

            // Step 4: Set ArgoCD application name for tracking
            String argoAppName = "iflow-" + flowName;
            status.setArgoApplicationName(argoAppName);
            status.setMessage("PipelineRun created, waiting for build completion");

        } catch (Exception e) {
            LOG.errorf(e, "Error reconciling IntegrationFlow '%s'", flowName);
            status.setPhase(IntegrationFlowStatus.Phase.Error);
            status.setMessage("Reconciliation failed: " + e.getMessage());
        }

        return UpdateControl.patchStatus(resource);
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

        // Set PipelineRun spec via additional properties
        var spec = new java.util.HashMap<String, Object>();
        spec.put("pipelineRef", Map.of("name", "integration-flow-build"));
        spec.put("params", java.util.List.of(
                Map.of("name", "git-url", "value", gitRepo),
                Map.of("name", "git-revision", "value", branch),
                Map.of("name", "commit-sha", "value", commitHash),
                Map.of("name", "flow-name", "value", flowName)
        ));
        pipelineRun.setAdditionalProperties(Map.of("spec", spec));

        kubernetesClient.resource(pipelineRun).inNamespace(namespace).create();
        LOG.infof("Created PipelineRun for flow '%s' in namespace '%s'", flowName, namespace);
    }
}
