package io.platform.api.v1alpha1;

import java.util.ArrayList;
import java.util.List;

public class IntegrationFlowStatus {

    public enum Phase {
        Scaffolding,
        Building,
        Deploying,
        Running,
        PartiallyHealthy,
        Error,
        Paused,
        Stopped,
        Resuming
    }

    private Phase phase;
    private String message;
    private String gitCommitHash;
    private String argoApplicationName;
    private String applicationSetName;
    private List<Condition> conditions = new ArrayList<>();
    private List<ClusterDeployment> clusterDeployments = new ArrayList<>();
    private String lastReconciledAt;
    private Long observedGeneration;
    private String currentState;
    private String circuitBreakerState;
    private String lastRollbackHash;
    private String prometheusRuleName;
    private String sonataFlowName;
    private String sonataFlowNamespace;
    private String sonataFlowReady;
    private String lastScaffoldedHash;

    public Phase getPhase() {
        return phase;
    }

    public void setPhase(Phase phase) {
        this.phase = phase;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getGitCommitHash() {
        return gitCommitHash;
    }

    public void setGitCommitHash(String gitCommitHash) {
        this.gitCommitHash = gitCommitHash;
    }

    public String getArgoApplicationName() {
        return argoApplicationName;
    }

    public void setArgoApplicationName(String argoApplicationName) {
        this.argoApplicationName = argoApplicationName;
    }

    public String getApplicationSetName() {
        return applicationSetName;
    }

    public void setApplicationSetName(String applicationSetName) {
        this.applicationSetName = applicationSetName;
    }

    public List<Condition> getConditions() {
        return conditions;
    }

    public void setConditions(List<Condition> conditions) {
        this.conditions = conditions;
    }

    public List<ClusterDeployment> getClusterDeployments() {
        return clusterDeployments;
    }

    public void setClusterDeployments(List<ClusterDeployment> clusterDeployments) {
        this.clusterDeployments = clusterDeployments;
    }

    public String getLastReconciledAt() {
        return lastReconciledAt;
    }

    public void setLastReconciledAt(String lastReconciledAt) {
        this.lastReconciledAt = lastReconciledAt;
    }

    public Long getObservedGeneration() {
        return observedGeneration;
    }

    public void setObservedGeneration(Long observedGeneration) {
        this.observedGeneration = observedGeneration;
    }

    public String getCurrentState() {
        return currentState;
    }

    public void setCurrentState(String currentState) {
        this.currentState = currentState;
    }

    public String getCircuitBreakerState() {
        return circuitBreakerState;
    }

    public void setCircuitBreakerState(String circuitBreakerState) {
        this.circuitBreakerState = circuitBreakerState;
    }

    public String getLastRollbackHash() {
        return lastRollbackHash;
    }

    public void setLastRollbackHash(String lastRollbackHash) {
        this.lastRollbackHash = lastRollbackHash;
    }

    public String getPrometheusRuleName() {
        return prometheusRuleName;
    }

    public void setPrometheusRuleName(String prometheusRuleName) {
        this.prometheusRuleName = prometheusRuleName;
    }

    public String getSonataFlowName() {
        return sonataFlowName;
    }

    public void setSonataFlowName(String sonataFlowName) {
        this.sonataFlowName = sonataFlowName;
    }

    public String getSonataFlowNamespace() {
        return sonataFlowNamespace;
    }

    public void setSonataFlowNamespace(String sonataFlowNamespace) {
        this.sonataFlowNamespace = sonataFlowNamespace;
    }

    public String getSonataFlowReady() {
        return sonataFlowReady;
    }

    public void setSonataFlowReady(String sonataFlowReady) {
        this.sonataFlowReady = sonataFlowReady;
    }

    public String getLastScaffoldedHash() {
        return lastScaffoldedHash;
    }

    public void setLastScaffoldedHash(String lastScaffoldedHash) {
        this.lastScaffoldedHash = lastScaffoldedHash;
    }

    public static class Condition {

        private String type;
        private String status;
        private String reason;
        private String message;
        private String lastTransitionTime;

        public Condition() {
        }

        public Condition(String type, String status, String reason, String message) {
            this.type = type;
            this.status = status;
            this.reason = reason;
            this.message = message;
            this.lastTransitionTime = java.time.Instant.now().toString();
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getReason() {
            return reason;
        }

        public void setReason(String reason) {
            this.reason = reason;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public String getLastTransitionTime() {
            return lastTransitionTime;
        }

        public void setLastTransitionTime(String lastTransitionTime) {
            this.lastTransitionTime = lastTransitionTime;
        }
    }

    public static class ClusterDeployment {

        private String clusterName;
        private String applicationName;
        private String syncStatus;
        private String healthStatus;
        private String lastSyncTime;
        private String version;

        public String getClusterName() {
            return clusterName;
        }

        public void setClusterName(String clusterName) {
            this.clusterName = clusterName;
        }

        public String getApplicationName() {
            return applicationName;
        }

        public void setApplicationName(String applicationName) {
            this.applicationName = applicationName;
        }

        public String getSyncStatus() {
            return syncStatus;
        }

        public void setSyncStatus(String syncStatus) {
            this.syncStatus = syncStatus;
        }

        public String getHealthStatus() {
            return healthStatus;
        }

        public void setHealthStatus(String healthStatus) {
            this.healthStatus = healthStatus;
        }

        public String getLastSyncTime() {
            return lastSyncTime;
        }

        public void setLastSyncTime(String lastSyncTime) {
            this.lastSyncTime = lastSyncTime;
        }

        public String getVersion() {
            return version;
        }

        public void setVersion(String version) {
            this.version = version;
        }
    }
}
