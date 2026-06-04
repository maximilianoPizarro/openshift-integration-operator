package io.platform.api.v1alpha1;

import java.util.List;
import java.util.Map;

public class TargetingSpec {

    public enum Strategy {
        selector,
        explicit,
        all
    }

    private Strategy strategy = Strategy.explicit;
    private Map<String, String> clusterSelector;
    /** Cluster names when strategy is explicit */
    private List<String> clusters;
    private List<ClusterExclusion> excludeClusters;

    public Strategy getStrategy() {
        return strategy;
    }

    public void setStrategy(Strategy strategy) {
        this.strategy = strategy;
    }

    public Map<String, String> getClusterSelector() {
        return clusterSelector;
    }

    public void setClusterSelector(Map<String, String> clusterSelector) {
        this.clusterSelector = clusterSelector;
    }

    public List<String> getClusters() {
        return clusters;
    }

    public void setClusters(List<String> clusters) {
        this.clusters = clusters;
    }

    public List<ClusterExclusion> getExcludeClusters() {
        return excludeClusters;
    }

    public void setExcludeClusters(List<ClusterExclusion> excludeClusters) {
        this.excludeClusters = excludeClusters;
    }

    public static class ClusterExclusion {

        private String name;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }
}
