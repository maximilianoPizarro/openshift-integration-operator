package io.platform.api.v1alpha1;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

public class IntegrationFlowSpec {

    private EngineType engine;
    private IntegrationType integrationType;
    private String gitRepository;
    private String branch = "main";
    private DesignRef designRef;
    /** @deprecated Use {@link #designRef} instead. Inline Kaoto design YAML/JSON kept for backward compatibility. */
    @Deprecated
    private String kaotoDesign;
    private TargetingSpec targeting;
    private String gitCredentialsSecret;
    private String gitProvider = "auto";
    private Integer replicas;

    public EngineType getEngine() {
        return engine;
    }

    public void setEngine(EngineType engine) {
        this.engine = engine;
    }

    public IntegrationType getIntegrationType() {
        return integrationType;
    }

    public void setIntegrationType(IntegrationType integrationType) {
        this.integrationType = integrationType;
    }

    @JsonIgnore
    public IntegrationType getResolvedType() {
        if (integrationType != null) return integrationType;
        return IntegrationType.fromEngineType(engine);
    }

    public String getGitRepository() {
        return gitRepository;
    }

    public void setGitRepository(String gitRepository) {
        this.gitRepository = gitRepository;
    }

    public String getBranch() {
        return branch;
    }

    public void setBranch(String branch) {
        this.branch = branch;
    }

    public DesignRef getDesignRef() {
        return designRef;
    }

    public void setDesignRef(DesignRef designRef) {
        this.designRef = designRef;
    }

    /** @deprecated Use {@link #getDesignRef()} instead. */
    @Deprecated
    public String getKaotoDesign() {
        return kaotoDesign;
    }

    /** @deprecated Use {@link #setDesignRef(DesignRef)} instead. */
    @Deprecated
    public void setKaotoDesign(String kaotoDesign) {
        this.kaotoDesign = kaotoDesign;
    }

    public TargetingSpec getTargeting() {
        return targeting;
    }

    public void setTargeting(TargetingSpec targeting) {
        this.targeting = targeting;
    }

    public String getGitCredentialsSecret() {
        return gitCredentialsSecret;
    }

    public void setGitCredentialsSecret(String gitCredentialsSecret) {
        this.gitCredentialsSecret = gitCredentialsSecret;
    }

    public String getGitProvider() {
        return gitProvider;
    }

    public void setGitProvider(String gitProvider) {
        this.gitProvider = gitProvider;
    }

    public Integer getReplicas() {
        return replicas;
    }

    public void setReplicas(Integer replicas) {
        this.replicas = replicas;
    }

    /**
     * @deprecated Use {@link TargetingSpec#getClusters()} via {@link #getTargeting()} instead.
     */
    @Deprecated
    @JsonProperty("targetClusters")
    public java.util.List<String> getTargetClusters() {
        return targeting != null ? targeting.getClusters() : null;
    }

    /**
     * @deprecated Use {@link TargetingSpec#setClusters(java.util.List)} via {@link #setTargeting(TargetingSpec)} instead.
     */
    @Deprecated
    @JsonProperty("targetClusters")
    public void setTargetClusters(java.util.List<String> targetClusters) {
        if (targeting == null) {
            targeting = new TargetingSpec();
        }
        targeting.setClusters(targetClusters);
    }
}
