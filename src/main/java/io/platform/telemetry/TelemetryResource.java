package io.platform.telemetry;

import io.smallrye.mutiny.Multi;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.jboss.resteasy.reactive.RestStreamElementType;

import java.time.Duration;

@Path("/api/telemetry")
public class TelemetryResource {

    @Inject
    TelemetryBroadcaster broadcaster;

    @GET
    @Path("/stream/{flowId}")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.APPLICATION_JSON)
    public Multi<NodeTelemetryDTO> stream(@PathParam("flowId") String flowId) {
        return broadcaster.streamForFlow(flowId);
    }

    @GET
    @Path("/snapshot/{flowId}")
    @Produces(MediaType.APPLICATION_JSON)
    public NodeTelemetryDTO snapshot(@PathParam("flowId") String flowId) {
        // Return a single point-in-time snapshot
        return broadcaster.streamForFlow(flowId)
            .collect().first()
            .await().atMost(Duration.ofSeconds(10));
    }
}
