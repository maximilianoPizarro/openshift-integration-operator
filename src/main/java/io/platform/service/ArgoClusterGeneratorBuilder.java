package io.platform.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Builds Argo CD ApplicationSet cluster generator blocks from IntegrationFlow targeting.
 */
public final class ArgoClusterGeneratorBuilder {

    private ArgoClusterGeneratorBuilder() {
    }

    public static Map<String, Object> buildClusterGenerator(Map<String, String> clusterSelector,
                                                            List<String> explicitClusters,
                                                            List<String> excludeClusters) {
        if (clusterSelector != null && !clusterSelector.isEmpty()) {
            return Map.of("clusters", Map.of("selector", Map.of("matchLabels", clusterSelector)));
        }

        List<Map<String, Object>> matchExpressions = new ArrayList<>();
        if (explicitClusters != null && !explicitClusters.isEmpty()) {
            matchExpressions.add(Map.of(
                    "key", "name",
                    "operator", "In",
                    "values", List.copyOf(explicitClusters)));
        }
        if (excludeClusters != null && !excludeClusters.isEmpty()) {
            matchExpressions.add(Map.of(
                    "key", "name",
                    "operator", "NotIn",
                    "values", List.copyOf(excludeClusters)));
        }

        if (!matchExpressions.isEmpty()) {
            return Map.of("clusters", Map.of("selector", Map.of("matchExpressions", matchExpressions)));
        }

        return Map.of("clusters", Collections.emptyMap());
    }
}
