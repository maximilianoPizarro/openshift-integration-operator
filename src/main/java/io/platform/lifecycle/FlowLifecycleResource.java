package io.platform.lifecycle;

import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.api.v1alpha1.IntegrationFlow;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.util.Map;

@Path("/api/namespaces/{namespace}/flows")
@Produces(MediaType.APPLICATION_JSON)
public class FlowLifecycleResource {

    private static final Logger LOG = Logger.getLogger(FlowLifecycleResource.class);

    @Inject
    KubernetesClient client;

    @Inject
    FlowAccessService flowAccessService;

    @Inject
    io.platform.service.git.GitProviderFactory gitProviderFactory;

    @Inject
    io.platform.ephemeral.EphemeralCleanupService ephemeralCleanupService;

    @Inject
    FlowLogService flowLogService;

    @Inject
    io.platform.service.git.GitUrlResolver gitUrlResolver;

    @PATCH
    @Path("/{name}/state")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response changeState(@HeaderParam("Authorization") String authHeader,
                                @PathParam("namespace") String namespace,
                                @PathParam("name") String name,
                                Map<String, String> body) {
        String desiredState = body.get("desiredState");
        if (desiredState == null || !desiredState.matches("running|paused|stopped")) {
            return Response.status(400).entity(Map.of("error", "desiredState must be running, paused, or stopped")).build();
        }
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "patch");
            flow.getSpec().setDesiredState(desiredState);
            client.resources(IntegrationFlow.class).inNamespace(namespace).resource(flow).update();

            LOG.infof("Flow %s/%s state changed to %s", namespace, name, desiredState);
            return Response.ok(Map.of("name", name, "namespace", namespace, "desiredState", desiredState)).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "Failed to change state for %s/%s", namespace, name);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST
    @Path("/{name}/rollback")
    public Response rollback(@HeaderParam("Authorization") String authHeader,
                             @PathParam("namespace") String namespace,
                             @PathParam("name") String name,
                             @QueryParam("commitHash") String commitHash) {
        if (commitHash == null || commitHash.isBlank()) {
            return Response.status(400).entity(Map.of("error", "commitHash is required")).build();
        }
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "patch");
            flow.getSpec().setBranch(commitHash);
            client.resources(IntegrationFlow.class).inNamespace(namespace).resource(flow).update();

            LOG.infof("Flow %s/%s rollback to %s", namespace, name, commitHash);
            return Response.ok(Map.of("name", name, "namespace", namespace, "rollbackTo", commitHash)).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST
    @Path("/{name}/circuit/{action}")
    public Response circuitBreaker(@HeaderParam("Authorization") String authHeader,
                                   @PathParam("namespace") String namespace,
                                   @PathParam("name") String name,
                                   @PathParam("action") String action) {
        if (!action.matches("open|close")) {
            return Response.status(400).entity(Map.of("error", "action must be open or close")).build();
        }
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "patch");
            String state = action.equals("open") ? "open" : "closed";
            flow.getStatus().setCircuitBreakerState(state);
            client.resources(IntegrationFlow.class).inNamespace(namespace).resource(flow).updateStatus();

            LOG.infof("Flow %s/%s circuit breaker: %s", namespace, name, state);
            return Response.ok(Map.of("name", name, "namespace", namespace, "circuitBreakerState", state)).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST
    @Path("/{name}/promote")
    public Response promote(@HeaderParam("Authorization") String authHeader,
                            @PathParam("namespace") String namespace,
                            @PathParam("name") String name,
                            @QueryParam("to") String targetNs) {
        if (targetNs == null || targetNs.isBlank()) {
            return Response.status(400).entity(Map.of("error", "target namespace (to) is required")).build();
        }
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "get");
            return Response.ok(Map.of(
                    "name", name,
                    "sourceNamespace", namespace,
                    "targetNamespace", targetNs,
                    "spec", flow.getSpec(),
                    "currentPhase", flow.getStatus() != null ? flow.getStatus().getPhase() : "unknown"
            )).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @GET
    @Path("/{name}/history")
    public Response getHistory(@HeaderParam("Authorization") String authHeader,
                               @PathParam("namespace") String namespace,
                               @PathParam("name") String name) {
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "get");
            return Response.ok(Map.of(
                    "name", name,
                    "namespace", namespace,
                    "gitRepository", flow.getSpec().getGitRepository(),
                    "branch", flow.getSpec().getBranch(),
                    "currentCommit", flow.getStatus() != null ? flow.getStatus().getGitCommitHash() : ""
            )).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @PUT
    @Path("/{name}/design")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response updateDesign(@HeaderParam("Authorization") String authHeader,
                                 @PathParam("namespace") String namespace,
                                 @PathParam("name") String name,
                                 Map<String, String> body) {
        String design = body.get("kaotoDesign");
        if (design == null || design.isBlank()) {
            return Response.status(400).entity(Map.of("error", "kaotoDesign is required")).build();
        }
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "patch");
            flow.getSpec().setKaotoDesign(design);
            client.resources(IntegrationFlow.class).inNamespace(namespace).resource(flow).update();

            String gitRepo = gitUrlResolver.resolve(flow.getSpec().getGitRepository());
            String branch = flow.getSpec().getBranch();
            if (gitRepo != null && !gitRepo.isBlank()) {
                try {
                    boolean isSonataFlow = flow.getSpec().getEngine() != null
                            && flow.getSpec().getEngine().name().equals("SONATAFLOW");
                    String workflowPath = isSonataFlow
                            ? "src/main/resources/workflows/flow.sw.yaml"
                            : "src/main/resources/routes/flow.camel.yaml";

                    String[] ownerRepo = extractOwnerAndRepo(gitRepo);
                    var provider = gitProviderFactory.getProvider(gitRepo, "auto");
                    provider.createOrUpdateFile(ownerRepo[0], ownerRepo[1], branch, workflowPath,
                            design, "Update flow design via console: " + name);
                    String commitHash = provider.getLatestCommitHash(ownerRepo[0], ownerRepo[1], branch);

                    LOG.infof("Flow %s/%s design updated and pushed to Git (commit: %s)", namespace, name, commitHash);
                    return Response.ok(Map.of(
                            "name", name,
                            "namespace", namespace,
                            "updated", true,
                            "gitCommitHash", commitHash,
                            "message", "Design updated and pushed to Git"
                    )).build();
                } catch (Exception gitErr) {
                    LOG.warnf("Design updated in CR but Git push failed for %s/%s: %s", namespace, name, gitErr.getMessage());
                    return Response.ok(Map.of(
                            "name", name,
                            "namespace", namespace,
                            "updated", true,
                            "gitSynced", false,
                            "message", "Design updated in CR; Git push failed: " + gitErr.getMessage()
                    )).build();
                }
            }

            LOG.infof("Flow %s/%s design updated (no git repo configured)", namespace, name);
            return Response.ok(Map.of("name", name, "namespace", namespace, "updated", true)).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "Failed to update design for %s/%s", namespace, name);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @GET
    @Path("/{name}/sonataflow")
    public Response getSonataFlowStatus(@HeaderParam("Authorization") String authHeader,
                                        @PathParam("namespace") String namespace,
                                        @PathParam("name") String name) {
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "get");
            var status = flow.getStatus();
            if (status == null || status.getSonataFlowName() == null) {
                return Response.ok(Map.of("name", name, "namespace", namespace, "sonataFlowDeployed", false)).build();
            }

            String sfNs = status.getSonataFlowNamespace() != null ? status.getSonataFlowNamespace() : "kogito-bpm";
            String sfName = status.getSonataFlowName();

            var result = new java.util.HashMap<String, Object>();
            result.put("name", name);
            result.put("namespace", namespace);
            result.put("sonataFlowDeployed", true);
            result.put("sonataFlowName", sfName);
            result.put("sonataFlowNamespace", sfNs);
            result.put("sonataFlowReady", status.getSonataFlowReady());

            try {
                var sfCR = client.genericKubernetesResources("sonataflow.org/v1alpha08", "SonataFlow")
                        .inNamespace(sfNs).withName(sfName).get();
                if (sfCR != null) {
                    @SuppressWarnings("unchecked")
                    var sfStatus = (java.util.Map<String, Object>) sfCR.getAdditionalProperties().get("status");
                    if (sfStatus != null) {
                        result.put("sonataFlowStatus", sfStatus);
                    }
                }
            } catch (Exception e) {
                result.put("sonataFlowStatusError", e.getMessage());
            }

            return Response.ok(result).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST
    @Path("/{name}/ephemeral/extend")
    public Response extendEphemeral(@HeaderParam("Authorization") String authHeader,
                                    @PathParam("namespace") String namespace,
                                    @PathParam("name") String name,
                                    @QueryParam("seconds") Integer seconds) {
        if (seconds == null || seconds <= 0) {
            return Response.status(400).entity(Map.of("error", "seconds query param is required and must be positive")).build();
        }
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "patch");
            if (flow.getSpec().getDeploymentMode() != io.platform.api.v1alpha1.DeploymentMode.EPHEMERAL) {
                return Response.status(400).entity(Map.of("error", "Flow is not in EPHEMERAL mode")).build();
            }

            java.time.Instant base = java.time.Instant.now();
            if (flow.getStatus() != null && flow.getStatus().getEphemeralExpiresAt() != null) {
                try {
                    base = java.time.Instant.parse(flow.getStatus().getEphemeralExpiresAt());
                    if (base.isBefore(java.time.Instant.now())) {
                        base = java.time.Instant.now();
                    }
                } catch (Exception ignored) {
                    base = java.time.Instant.now();
                }
            }
            java.time.Instant newExpiry = base.plusSeconds(seconds);
            flow.getStatus().setEphemeralExpiresAt(newExpiry.toString());
            flow.getStatus().setPhase(IntegrationFlowStatus.Phase.Running);
            flow.getStatus().setMessage("TTL extended to " + newExpiry);

            var annotations = flow.getMetadata().getAnnotations();
            if (annotations == null) {
                annotations = new java.util.HashMap<>();
                flow.getMetadata().setAnnotations(annotations);
            }
            annotations.put("platform.io/ephemeral-expires-at", newExpiry.toString());

            client.resources(IntegrationFlow.class).inNamespace(namespace).resource(flow).update();
            client.resources(IntegrationFlow.class).inNamespace(namespace).resource(flow).updateStatus();

            return Response.ok(Map.of(
                    "name", name,
                    "namespace", namespace,
                    "ephemeralExpiresAt", newExpiry.toString(),
                    "extendedBySeconds", seconds)).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST
    @Path("/{name}/promote-to-gitops")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response promoteToGitOps(@HeaderParam("Authorization") String authHeader,
                                    @PathParam("namespace") String namespace,
                                    @PathParam("name") String name,
                                    Map<String, String> body) {
        String gitRepository = body.get("gitRepository");
        String branch = body.getOrDefault("branch", "main");
        if (gitRepository == null || gitRepository.isBlank()) {
            return Response.status(400).entity(Map.of("error", "gitRepository is required")).build();
        }
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "patch");
            if (flow.getSpec().getDeploymentMode() != io.platform.api.v1alpha1.DeploymentMode.EPHEMERAL) {
                return Response.status(400).entity(Map.of("error", "Flow is already in GITOPS mode")).build();
            }

            flow.getSpec().setDeploymentMode(io.platform.api.v1alpha1.DeploymentMode.GITOPS);
            flow.getSpec().setGitRepository(gitRepository);
            flow.getSpec().setBranch(branch);
            ephemeralCleanupService.cleanup(name, namespace);
            flow.getStatus().setLastScaffoldedHash(null);
            flow.getStatus().setPhase(IntegrationFlowStatus.Phase.Scaffolding);
            flow.getStatus().setMessage("Promoted to GitOps; reconciliation pending");

            client.resources(IntegrationFlow.class).inNamespace(namespace).resource(flow).update();

            return Response.ok(Map.of(
                    "name", name,
                    "namespace", namespace,
                    "deploymentMode", "GITOPS",
                    "gitRepository", gitRepository,
                    "branch", branch,
                    "message", "Flow promoted to GitOps mode")).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @GET
    @Path("/{name}/logs")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getLogs(@HeaderParam("Authorization") String authHeader,
                            @PathParam("namespace") String namespace,
                            @PathParam("name") String name,
                            @QueryParam("tailLines") @DefaultValue("500") int tailLines,
                            @QueryParam("container") String container) {
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "get");
            var result = flowLogService.fetchLogs(flow, tailLines, container);
            return Response.ok(Map.of(
                    "name", name,
                    "namespace", result.pod().namespace(),
                    "podName", result.pod().podName(),
                    "container", result.pod().container() != null ? result.pod().container() : "",
                    "containers", result.containers(),
                    "logs", result.logs(),
                    "timestamp", result.timestamp()
            )).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (IllegalStateException e) {
            return Response.status(404).entity(Map.of("error", e.getMessage())).build();
        } catch (Exception e) {
            LOG.errorf(e, "Failed to fetch logs for %s/%s", namespace, name);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @GET
    @Path("/{name}/resources")
    public Response getResources(@HeaderParam("Authorization") String authHeader,
                                 @PathParam("namespace") String namespace,
                                 @PathParam("name") String name) {
        try {
            String token = flowAccessService.requireToken(authHeader);
            var flow = flowAccessService.getFlow(token, namespace, name, "get");
            return Response.ok(flowLogService.listResources(flow)).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @GET
    @Path("/{name}/dependencies")
    public Response getDependencies(@HeaderParam("Authorization") String authHeader,
                                    @PathParam("namespace") String namespace,
                                    @PathParam("name") String name) {
        try {
            String token = flowAccessService.requireToken(authHeader);
            flowAccessService.requireFlowAccess(token, namespace, "get");
            var allFlows = client.resources(IntegrationFlow.class)
                    .inNamespace(namespace).list().getItems();

            var dependents = allFlows.stream()
                    .filter(f -> !f.getMetadata().getName().equals(name))
                    .filter(f -> {
                        String design = f.getSpec().getKaotoDesign();
                        return design != null && (
                                design.contains("direct:" + name) ||
                                design.contains("kafka:" + name) ||
                                design.contains("seda:" + name)
                        );
                    })
                    .map(f -> Map.of(
                            "name", (Object) f.getMetadata().getName(),
                            "namespace", (Object) f.getMetadata().getNamespace(),
                            "type", (Object) String.valueOf(f.getSpec().getResolvedType()),
                            "phase", (Object) (f.getStatus() != null ? String.valueOf(f.getStatus().getPhase()) : "Pending")
                    ))
                    .toList();

            return Response.ok(Map.of(
                    "name", name,
                    "namespace", namespace,
                    "dependents", dependents,
                    "dependentCount", dependents.size()
            )).build();
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    private String[] extractOwnerAndRepo(String gitRepository) {
        if (gitRepository == null || gitRepository.isBlank()) {
            return new String[]{"", "unknown-repo"};
        }
        String path = gitRepository.replaceAll("\\.git$", "");
        path = path.replaceAll("^https?://[^/]+/", "");
        String[] parts = path.split("/");
        if (parts.length >= 2) {
            return new String[]{parts[parts.length - 2], parts[parts.length - 1]};
        }
        return new String[]{"", parts[0]};
    }
}
