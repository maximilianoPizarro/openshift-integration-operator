package io.platform.lifecycle;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

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

    @GET
    public Response getConfig() {
        return Response.ok(Map.of(
                "platformNamespace", platformNamespace,
                "sonataFlowEnabled", sonataFlowEnabled,
                "sonataFlowNamespace", sonataFlowNamespace,
                "sonataFlowConsoleUrl", sonataFlowConsoleUrl.orElse(""),
                "sonataFlowConsoleRouteHost", sonataFlowConsoleRouteHost.orElse(""),
                "kaotoUrl", kaotoInstanceUrl.orElse(""),
                "kaotoRouteHost", kaotoRouteHost.orElse(""),
                "gitProvider", gitProvider,
                "tektonEnabled", tektonEnabled
        )).build();
    }
}
