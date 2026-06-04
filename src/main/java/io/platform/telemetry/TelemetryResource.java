package io.platform.telemetry;

import io.smallrye.mutiny.Multi;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.jboss.resteasy.reactive.RestStreamElementType;

import java.time.Duration;
import java.util.List;
import java.util.Random;

@Path("/api/telemetry")
public class TelemetryResource {

    private static final Random RANDOM = new Random();

    private static final List<String> CAMEL_NODES = List.of(
            "timer-trigger", "set-body-transform", "log-output",
            "to-kafka-sink", "choice-router", "direct-process");

    private static final List<String> SONATAFLOW_STATES = List.of(
            "StartState", "EvaluateRequest", "CallExternalAPI",
            "TransformData", "NotifyResult", "EndState");

    /**
     * SSE stream delivering real-time per-node telemetry for a given flow.
     * The frontend uses this to color Kaoto canvas nodes dynamically.
     */
    @GET
    @Path("/stream/{flowId}")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.APPLICATION_JSON)
    public Multi<NodeTelemetryDTO> streamTelemetry(@PathParam("flowId") String flowId) {
        return Multi.createFrom().ticks().every(Duration.ofSeconds(1))
                .map(tick -> generateTelemetry(flowId));
    }

    @GET
    @Path("/snapshot/{flowId}")
    @Produces(MediaType.APPLICATION_JSON)
    public List<NodeTelemetryDTO> getSnapshot(@PathParam("flowId") String flowId) {
        List<String> nodes = flowId.startsWith("sw-") ? SONATAFLOW_STATES : CAMEL_NODES;
        return nodes.stream()
                .map(nodeId -> new NodeTelemetryDTO(
                        nodeId,
                        randomStatus(),
                        RANDOM.nextLong(5, 500)))
                .toList();
    }

    private NodeTelemetryDTO generateTelemetry(String flowId) {
        List<String> nodes = flowId.startsWith("sw-") ? SONATAFLOW_STATES : CAMEL_NODES;
        String nodeId = nodes.get(RANDOM.nextInt(nodes.size()));
        return new NodeTelemetryDTO(nodeId, randomStatus(), RANDOM.nextLong(5, 500));
    }

    private NodeTelemetryDTO.Status randomStatus() {
        int roll = RANDOM.nextInt(100);
        if (roll < 80) return NodeTelemetryDTO.Status.healthy;
        if (roll < 95) return NodeTelemetryDTO.Status.degraded;
        return NodeTelemetryDTO.Status.error;
    }
}
