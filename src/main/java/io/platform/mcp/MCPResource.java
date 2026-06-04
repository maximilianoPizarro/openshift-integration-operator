package io.platform.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

@Path("/api/mcp")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MCPResource {

    @Inject
    MCPBridgeService mcpBridgeService;

    @GET
    @Path("/tools")
    public List<MCPToolDefinition> listTools(@QueryParam("serverUrl") String serverUrl) {
        return mcpBridgeService.listTools(serverUrl);
    }

    @POST
    @Path("/tools/{toolName}/call")
    public JsonNode callTool(@PathParam("toolName") String toolName,
                             @QueryParam("serverUrl") String serverUrl,
                             JsonNode arguments) {
        return mcpBridgeService.callTool(serverUrl, toolName, arguments);
    }
}
