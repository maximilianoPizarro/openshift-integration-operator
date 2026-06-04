package io.platform.telemetry;

public record NodeTelemetryDTO(
        /** Camel step ID or SonataFlow state name */
        String nodeId,
        /** Node health status */
        Status status,
        /** 99th percentile latency in milliseconds */
        long latencyP99
) {
    public enum Status {
        healthy,
        error,
        degraded
    }
}
