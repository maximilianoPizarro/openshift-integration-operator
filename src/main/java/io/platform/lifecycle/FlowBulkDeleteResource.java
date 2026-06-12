package io.platform.lifecycle;

import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.api.v1alpha1.IntegrationFlow;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Path("/api/flows/bulk-delete")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class FlowBulkDeleteResource {

    private static final Logger LOG = Logger.getLogger(FlowBulkDeleteResource.class);

    @Inject
    KubernetesClient client;

    @Inject
    FlowAccessService flowAccessService;

    @POST
    public Response bulkDelete(@HeaderParam("Authorization") String authHeader,
                               List<Map<String, String>> items) {
        String token = flowAccessService.requireToken(authHeader);
        if (items == null || items.isEmpty()) {
            return Response.status(400).entity(Map.of("error", "items list is required")).build();
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (Map<String, String> item : items) {
            String namespace = item.get("namespace");
            String name = item.get("name");
            if (namespace == null || namespace.isBlank() || name == null || name.isBlank()) {
                results.add(Map.of("namespace", String.valueOf(namespace), "name", String.valueOf(name),
                        "deleted", false, "error", "namespace and name are required"));
                continue;
            }
            try {
                if (!flowAccessService.canAccessFlow(token, namespace, "delete")) {
                    results.add(Map.of("namespace", namespace, "name", name,
                            "deleted", false, "error", "Forbidden"));
                    continue;
                }
                var deleted = client.resources(IntegrationFlow.class)
                        .inNamespace(namespace).withName(name).delete();
                boolean ok = deleted != null && !deleted.isEmpty();
                results.add(Map.of("namespace", namespace, "name", name, "deleted", ok));
                if (ok) {
                    LOG.infof("Bulk delete removed flow %s/%s", namespace, name);
                }
            } catch (Exception e) {
                results.add(Map.of("namespace", namespace, "name", name,
                        "deleted", false, "error", e.getMessage()));
            }
        }
        long deletedCount = results.stream().filter(r -> Boolean.TRUE.equals(r.get("deleted"))).count();
        return Response.ok(Map.of("results", results, "deletedCount", deletedCount)).build();
    }
}
