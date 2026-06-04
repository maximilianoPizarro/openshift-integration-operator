package io.platform.telemetry;

import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

@ApplicationScoped
public class TelemetryBroadcaster {

    private static final Logger LOG = Logger.getLogger(TelemetryBroadcaster.class);

    // One data source per flow, N subscribers via broadcast
    private final Map<String, Multi<NodeTelemetryDTO>> streams = new ConcurrentHashMap<>();

    public Multi<NodeTelemetryDTO> streamForFlow(String flowId) {
        return streams.computeIfAbsent(flowId, id ->
            Multi.createFrom().ticks().every(Duration.ofSeconds(5))
                .onItem().transformToUniAndMerge(tick -> fetchTelemetry(id))
                .broadcast().toAllSubscribers()
        );
    }

    // Single query every 5s regardless of subscriber count
    // TODO: Replace with real OTel/Prometheus queries
    private Uni<NodeTelemetryDTO> fetchTelemetry(String flowId) {
        return Uni.createFrom().item(() -> {
            // Generate mock data for now - to be replaced with real OTel collector queries
            NodeTelemetryDTO dto = new NodeTelemetryDTO();
            dto.setSchemaVersion("1.0");
            dto.setFlowId(flowId);
            dto.setTimestamp(Instant.now().toString());

            ThreadLocalRandom rnd = ThreadLocalRandom.current();
            String[] nodeIds = {"http-source-1", "log-processor", "kafka-sink", "transform-1"};
            String[] clusterNames = {"local"};

            List<NodeTelemetryDTO.NodeMetrics> nodes = new ArrayList<>();
            for (String nodeId : nodeIds) {
                NodeTelemetryDTO.NodeMetrics node = new NodeTelemetryDTO.NodeMetrics();
                node.setNodeId(nodeId);

                List<NodeTelemetryDTO.ClusterMetrics> clusters = new ArrayList<>();
                for (String cluster : clusterNames) {
                    NodeTelemetryDTO.ClusterMetrics cm = new NodeTelemetryDTO.ClusterMetrics();
                    cm.setClusterName(cluster);
                    cm.setStatus(rnd.nextInt(10) < 8 ? NodeTelemetryDTO.Status.healthy :
                                 rnd.nextBoolean() ? NodeTelemetryDTO.Status.degraded : NodeTelemetryDTO.Status.error);
                    cm.setLatencyP99Ms(rnd.nextDouble(5, 200));
                    cm.setThroughputRpm(rnd.nextDouble(100, 5000));
                    cm.setErrorRate(rnd.nextDouble(0, 0.05));
                    cm.setActiveTraces(rnd.nextInt(0, 20));
                    clusters.add(cm);
                }
                node.setClusters(clusters);
                nodes.add(node);
            }
            dto.setNodes(nodes);
            return dto;
        });
    }

    public void removeStream(String flowId) {
        streams.remove(flowId);
    }
}
