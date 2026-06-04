package io.platform.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.List;

/**
 * Bridge service implementing the MCP (Model Context Protocol) client.
 * Connects to external MCP servers to discover and invoke tools,
 * enabling AI-powered workflow steps in Camel routes and SonataFlow definitions.
 */
@ApplicationScoped
public class MCPBridgeService {

    private static final Logger LOG = Logger.getLogger(MCPBridgeService.class);

    @Inject
    ObjectMapper objectMapper;

    /**
     * Discovers available tools from an MCP server endpoint.
     * Protocol: JSON-RPC 2.0 with method "tools/list"
     */
    public List<MCPToolDefinition> listTools(String mcpServerUrl) {
        LOG.infof("Discovering MCP tools from %s", mcpServerUrl);

        // TODO: implement actual MCP JSON-RPC call
        // POST to mcpServerUrl with:
        // {"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
        // Parse response.result.tools[] into MCPToolDefinition list

        return List.of(
                new MCPToolDefinition("web_search",
                        "Search the web for information",
                        objectMapper.createObjectNode()
                                .put("type", "object")
                                .set("properties", objectMapper.createObjectNode()
                                        .set("query", objectMapper.createObjectNode()
                                                .put("type", "string")
                                                .put("description", "Search query")))),
                new MCPToolDefinition("read_file",
                        "Read contents of a file",
                        objectMapper.createObjectNode()
                                .put("type", "object")
                                .set("properties", objectMapper.createObjectNode()
                                        .set("path", objectMapper.createObjectNode()
                                                .put("type", "string")
                                                .put("description", "File path to read"))))
        );
    }

    /**
     * Invokes a specific tool on an MCP server.
     * Protocol: JSON-RPC 2.0 with method "tools/call"
     */
    public JsonNode callTool(String mcpServerUrl, String toolName, JsonNode arguments) {
        LOG.infof("Calling MCP tool '%s' on %s", toolName, mcpServerUrl);

        // TODO: implement actual MCP JSON-RPC call
        // POST to mcpServerUrl with:
        // {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"<toolName>","arguments":<arguments>}}
        // Return response.result.content

        ObjectNode stub = objectMapper.createObjectNode();
        stub.put("status", "stub");
        stub.put("tool", toolName);
        stub.put("message", "MCP tool call stub - implement actual JSON-RPC transport");
        return stub;
    }
}
