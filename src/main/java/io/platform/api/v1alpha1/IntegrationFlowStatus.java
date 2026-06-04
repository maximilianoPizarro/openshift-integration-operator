package io.platform.api.v1alpha1;

public class IntegrationFlowStatus {

    public enum Phase {
        Scaffolding,
        Building,
        Deploying,
        Running,
        Error
    }

    private Phase phase;
    private String gitCommitHash;
    private String argoApplicationName;
    private String message;

    public Phase getPhase() { return phase; }
    public void setPhase(Phase phase) { this.phase = phase; }

    public String getGitCommitHash() { return gitCommitHash; }
    public void setGitCommitHash(String gitCommitHash) { this.gitCommitHash = gitCommitHash; }

    public String getArgoApplicationName() { return argoApplicationName; }
    public void setArgoApplicationName(String argoApplicationName) { this.argoApplicationName = argoApplicationName; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
