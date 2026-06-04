package io.platform.api.v1alpha1;

import java.util.List;

public class IntegrationFlowSpec {

    private String gitRepository;
    private String branch = "main";
    private List<String> targetClusters;
    private EngineType engine;
    /** Raw Kaoto design: YAML for Camel routes, JSON/YAML for SonataFlow definitions */
    private String kaotoDesign;

    public String getGitRepository() { return gitRepository; }
    public void setGitRepository(String gitRepository) { this.gitRepository = gitRepository; }

    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }

    public List<String> getTargetClusters() { return targetClusters; }
    public void setTargetClusters(List<String> targetClusters) { this.targetClusters = targetClusters; }

    public EngineType getEngine() { return engine; }
    public void setEngine(EngineType engine) { this.engine = engine; }

    public String getKaotoDesign() { return kaotoDesign; }
    public void setKaotoDesign(String kaotoDesign) { this.kaotoDesign = kaotoDesign; }
}
