package io.platform.lifecycle;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.fabric8.kubernetes.client.KubernetesClient;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.Map;

@Path("/api/flow-catalog")
@Produces(MediaType.APPLICATION_JSON)
public class FlowCatalogResource {

    private static final Logger LOG = Logger.getLogger(FlowCatalogResource.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Inject
    KubernetesClient client;

    @ConfigProperty(name = "platform.flow-catalog.source", defaultValue = "remote")
    String flowCatalogSource;

    @ConfigProperty(name = "platform.namespace", defaultValue = "openshift-integration")
    String platformNamespace;

    @ConfigProperty(name = "platform.flow-catalog.config-map-name", defaultValue = "flow-catalog")
    String configMapName;

    @ConfigProperty(name = "platform.flow-catalog.config-map-key", defaultValue = "flow-catalog.json")
    String configMapKey;

    @GET
    public Response getFlowCatalog() {
        if (!"configmap".equalsIgnoreCase(flowCatalogSource)) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of(
                            "error", "Flow catalog is served remotely",
                            "source", flowCatalogSource))
                    .build();
        }

        try {
            var configMap = client.configMaps()
                    .inNamespace(platformNamespace)
                    .withName(configMapName)
                    .get();

            if (configMap == null || configMap.getData() == null) {
                return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                        .entity(Map.of(
                                "error", "Flow catalog ConfigMap not found",
                                "configMapName", configMapName,
                                "namespace", platformNamespace,
                                "hint", "Import with: oc create configmap " + configMapName
                                        + " --from-file=" + configMapKey + "=docs/flow-catalog.json"
                                        + " -n " + platformNamespace))
                        .build();
            }

            var json = configMap.getData().get(configMapKey);
            if (json == null || json.isBlank()) {
                return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                        .entity(Map.of(
                                "error", "Flow catalog key missing in ConfigMap",
                                "configMapName", configMapName,
                                "configMapKey", configMapKey))
                        .build();
            }

            var catalog = MAPPER.readTree(json);
            return Response.ok(catalog).build();
        } catch (Exception e) {
            LOG.errorf(e, "Failed to load flow catalog from ConfigMap %s/%s", platformNamespace, configMapName);
            return Response.status(Response.Status.SERVICE_UNAVAILABLE)
                    .entity(Map.of("error", e.getMessage()))
                    .build();
        }
    }
}
