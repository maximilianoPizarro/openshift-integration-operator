package io.platform.mcp;

import com.fasterxml.jackson.databind.JsonNode;

public record MCPToolDefinition(
        String name,
        String description,
        JsonNode inputSchema
) {}
