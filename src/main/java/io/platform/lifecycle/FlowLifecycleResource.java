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

@Path("/api/flows")
@Produces(MediaType.APPLICATION_JSON)
public class FlowLifecycleResource {

    private static final Logger LOG = Logger.getLogger(FlowLifecycleResource.class);
    private static final String NAMESPACE = "openshift-integration";

    @Inject
    KubernetesClient client;

    @PATCH
    @Path("/{name}/state")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response changeState(@PathParam("name") String name, Map<String, String> body) {
        String desiredState = body.get("desiredState");
        if (desiredState == null || !desiredState.matches("running|paused|stopped")) {
            return Response.status(400).entity(Map.of("error", "desiredState must be running, paused, or stopped")).build();
        }
        try {
            var flow = client.resources(IntegrationFlow.class)
                    .inNamespace(NAMESPACE).withName(name).get();
            if (flow == null) return Response.status(404).entity(Map.of("error", "Flow not found")).build();

            flow.getSpec().setDesiredState(desiredState);
            client.resources(IntegrationFlow.class).inNamespace(NAMESPACE).resource(flow).update();

            LOG.infof("Flow %s state changed to %s", name, desiredState);
            return Response.ok(Map.of("name", name, "desiredState", desiredState)).build();
        } catch (Exception e) {
            LOG.errorf(e, "Failed to change state for %s", name);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST
    @Path("/{name}/rollback")
    public Response rollback(@PathParam("name") String name, @QueryParam("commitHash") String commitHash) {
        if (commitHash == null || commitHash.isBlank()) {
            return Response.status(400).entity(Map.of("error", "commitHash is required")).build();
        }
        try {
            var flow = client.resources(IntegrationFlow.class)
                    .inNamespace(NAMESPACE).withName(name).get();
            if (flow == null) return Response.status(404).entity(Map.of("error", "Flow not found")).build();

            flow.getSpec().setBranch(commitHash);
            client.resources(IntegrationFlow.class).inNamespace(NAMESPACE).resource(flow).update();

            LOG.infof("Flow %s rollback to %s", name, commitHash);
            return Response.ok(Map.of("name", name, "rollbackTo", commitHash)).build();
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST
    @Path("/{name}/circuit/{action}")
    public Response circuitBreaker(@PathParam("name") String name, @PathParam("action") String action) {
        if (!action.matches("open|close")) {
            return Response.status(400).entity(Map.of("error", "action must be open or close")).build();
        }
        try {
            var flow = client.resources(IntegrationFlow.class)
                    .inNamespace(NAMESPACE).withName(name).get();
            if (flow == null) return Response.status(404).entity(Map.of("error", "Flow not found")).build();

            String state = action.equals("open") ? "open" : "closed";
            flow.getStatus().setCircuitBreakerState(state);
            client.resources(IntegrationFlow.class).inNamespace(NAMESPACE)
                    .resource(flow).updateStatus();

            LOG.infof("Flow %s circuit breaker: %s", name, state);
            return Response.ok(Map.of("name", name, "circuitBreakerState", state)).build();
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST
    @Path("/{name}/promote")
    public Response promote(@PathParam("name") String name, @QueryParam("to") String targetNs) {
        if (targetNs == null || targetNs.isBlank()) {
            return Response.status(400).entity(Map.of("error", "target namespace (to) is required")).build();
        }
        try {
            var flow = client.resources(IntegrationFlow.class)
                    .inNamespace(NAMESPACE).withName(name).get();
            if (flow == null) return Response.status(404).entity(Map.of("error", "Flow not found")).build();

            return Response.ok(Map.of(
                "name", name,
                "sourceNamespace", NAMESPACE,
                "targetNamespace", targetNs,
                "spec", flow.getSpec(),
                "currentPhase", flow.getStatus() != null ? flow.getStatus().getPhase() : "unknown"
            )).build();
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @GET
    @Path("/{name}/history")
    public Response getHistory(@PathParam("name") String name) {
        try {
            var flow = client.resources(IntegrationFlow.class)
                    .inNamespace(NAMESPACE).withName(name).get();
            if (flow == null) return Response.status(404).entity(Map.of("error", "Flow not found")).build();

            return Response.ok(Map.of(
                "name", name,
                "gitRepository", flow.getSpec().getGitRepository(),
                "branch", flow.getSpec().getBranch(),
                "currentCommit", flow.getStatus() != null ? flow.getStatus().getGitCommitHash() : ""
            )).build();
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    @GET
    @Path("/{name}/dependencies")
    public Response getDependencies(@PathParam("name") String name) {
        try {
            var allFlows = client.resources(IntegrationFlow.class)
                    .inNamespace(NAMESPACE).list().getItems();

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
                        "type", (Object) String.valueOf(f.getSpec().getResolvedType()),
                        "phase", (Object) (f.getStatus() != null ? String.valueOf(f.getStatus().getPhase()) : "Pending")
                    ))
                    .toList();

            return Response.ok(Map.of(
                "name", name,
                "dependents", dependents,
                "dependentCount", dependents.size()
            )).build();
        } catch (Exception e) {
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }
}
