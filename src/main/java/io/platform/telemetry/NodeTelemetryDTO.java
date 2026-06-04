package io.platform.telemetry;

import java.util.List;

public class NodeTelemetryDTO {

    private String schemaVersion = "1.0";
    private String flowId;
    private String timestamp;
    private List<NodeMetrics> nodes;

    public String getSchemaVersion() {
        return schemaVersion;
    }

    public void setSchemaVersion(String schemaVersion) {
        this.schemaVersion = schemaVersion;
    }

    public String getFlowId() {
        return flowId;
    }

    public void setFlowId(String flowId) {
        this.flowId = flowId;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public List<NodeMetrics> getNodes() {
        return nodes;
    }

    public void setNodes(List<NodeMetrics> nodes) {
        this.nodes = nodes;
    }

    public static class NodeMetrics {

        private String nodeId;
        private List<ClusterMetrics> clusters;

        public String getNodeId() {
            return nodeId;
        }

        public void setNodeId(String nodeId) {
            this.nodeId = nodeId;
        }

        public List<ClusterMetrics> getClusters() {
            return clusters;
        }

        public void setClusters(List<ClusterMetrics> clusters) {
            this.clusters = clusters;
        }
    }

    public static class ClusterMetrics {

        private String clusterName;
        private Status status;
        private double latencyP99Ms;
        private double throughputRpm;
        private double errorRate;
        private int activeTraces;

        public String getClusterName() {
            return clusterName;
        }

        public void setClusterName(String clusterName) {
            this.clusterName = clusterName;
        }

        public Status getStatus() {
            return status;
        }

        public void setStatus(Status status) {
            this.status = status;
        }

        public double getLatencyP99Ms() {
            return latencyP99Ms;
        }

        public void setLatencyP99Ms(double latencyP99Ms) {
            this.latencyP99Ms = latencyP99Ms;
        }

        public double getThroughputRpm() {
            return throughputRpm;
        }

        public void setThroughputRpm(double throughputRpm) {
            this.throughputRpm = throughputRpm;
        }

        public double getErrorRate() {
            return errorRate;
        }

        public void setErrorRate(double errorRate) {
            this.errorRate = errorRate;
        }

        public int getActiveTraces() {
            return activeTraces;
        }

        public void setActiveTraces(int activeTraces) {
            this.activeTraces = activeTraces;
        }
    }

    public enum Status {
        healthy,
        error,
        degraded,
        unknown
    }
}
