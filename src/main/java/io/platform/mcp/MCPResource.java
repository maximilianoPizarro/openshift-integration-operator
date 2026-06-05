package io.platform.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import io.fabric8.kubernetes.api.model.authentication.TokenReview;
import io.fabric8.kubernetes.api.model.authentication.TokenReviewBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.List;
import java.util.Optional;

@Path("/api/mcp")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MCPResource {

    @Inject
    MCPBridgeService mcpBridgeService;

    @Inject
    KubernetesClient kubeClient;

    @ConfigProperty(name = "mcp.allowed-server-urls", defaultValue = "")
    Optional<List<String>> allowedUrls;

    private void validateServerUrl(String serverUrl) {
        if (allowedUrls.isPresent() && !allowedUrls.get().isEmpty()) {
            boolean allowed = allowedUrls.get().stream()
                    .anyMatch(prefix -> serverUrl != null && serverUrl.startsWith(prefix));
            if (!allowed) {
                throw new WebApplicationException("Server URL not in allowlist", 403);
            }
        }
    }

    private void validateToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new WebApplicationException("Missing or invalid Authorization header", 401);
        }
        String token = authHeader.substring(7);

        TokenReview review = new TokenReviewBuilder()
                .withNewSpec().withToken(token).endSpec()
                .build();

        TokenReview result = kubeClient.tokenReviews().create(review);
        if (result.getStatus() == null || !Boolean.TRUE.equals(result.getStatus().getAuthenticated())) {
            throw new WebApplicationException("Token not authenticated", 403);
        }
    }

    @GET
    @Path("/tools")
    public List<MCPToolDefinition> listTools(@HeaderParam("Authorization") String authHeader,
                                             @QueryParam("serverUrl") String serverUrl) {
        validateToken(authHeader);
        validateServerUrl(serverUrl);
        return mcpBridgeService.listTools(serverUrl);
    }

    @POST
    @Path("/tools/{toolName}/call")
    public JsonNode callTool(@HeaderParam("Authorization") String authHeader,
                             @PathParam("toolName") String toolName,
                             @QueryParam("serverUrl") String serverUrl,
                             JsonNode arguments) {
        validateToken(authHeader);
        validateServerUrl(serverUrl);
        return mcpBridgeService.callTool(serverUrl, toolName, arguments);
    }
}
