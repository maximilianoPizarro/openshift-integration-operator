package io.platform.lifecycle;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.LinkedHashMap;
import java.util.Map;

@Path("/api/config")
@Produces(MediaType.APPLICATION_JSON)
public class PlatformConfigResource {

    @ConfigProperty(name = "platform.namespace", defaultValue = "openshift-integration")
    String platformNamespace;

    @ConfigProperty(name = "sonataflow.enabled", defaultValue = "true")
    boolean sonataFlowEnabled;

    @ConfigProperty(name = "sonataflow.namespace", defaultValue = "kogito-bpm")
    String sonataFlowNamespace;

    @ConfigProperty(name = "sonataflow.console-url", defaultValue = "")
    java.util.Optional<String> sonataFlowConsoleUrl;

    @ConfigProperty(name = "sonataflow.console-route-host", defaultValue = "")
    java.util.Optional<String> sonataFlowConsoleRouteHost;

    @ConfigProperty(name = "kaoto.instance-url", defaultValue = "")
    java.util.Optional<String> kaotoInstanceUrl;

    @ConfigProperty(name = "kaoto.route-host", defaultValue = "")
    java.util.Optional<String> kaotoRouteHost;

    @ConfigProperty(name = "git.provider", defaultValue = "auto")
    String gitProvider;

    @ConfigProperty(name = "tekton.enabled", defaultValue = "true")
    boolean tektonEnabled;

    @ConfigProperty(name = "platform.flow-catalog.source", defaultValue = "remote")
    String flowCatalogSource;

    @ConfigProperty(name = "platform.flow-catalog.config-map-name", defaultValue = "flow-catalog")
    String flowCatalogConfigMapName;

    @ConfigProperty(name = "console-plugin.version", defaultValue = "0.5.0")
    String consolePluginVersion;

    @GET
    public Response getConfig() {
        var config = new LinkedHashMap<String, Object>();
        config.put("platformNamespace", platformNamespace);
        config.put("sonataFlowEnabled", sonataFlowEnabled);
        config.put("sonataFlowNamespace", sonataFlowNamespace);
        config.put("sonataFlowConsoleUrl", sonataFlowConsoleUrl.orElse(""));
        config.put("sonataFlowConsoleRouteHost", sonataFlowConsoleRouteHost.orElse(""));
        config.put("kaotoUrl", kaotoInstanceUrl.orElse(""));
        config.put("kaotoRouteHost", kaotoRouteHost.orElse(""));
        config.put("gitProvider", gitProvider);
        config.put("tektonEnabled", tektonEnabled);
        config.put("flowCatalogSource", flowCatalogSource);
        config.put("flowCatalogConfigMapName", flowCatalogConfigMapName);
        config.put("consolePluginVersion", consolePluginVersion);
        return Response.ok(config).build();
    }
}
