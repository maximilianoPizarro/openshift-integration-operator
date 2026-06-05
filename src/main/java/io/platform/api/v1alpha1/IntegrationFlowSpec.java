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
    private String schedule;
    private ResilienceSpec resilience;
    private AlertingSpec alerting;
    private RolloutSpec rollout;
    private String desiredState;
    private String owner;
    private java.util.List<String> editors;
    private java.util.List<String> viewers;
    private java.util.List<SecretRef> secrets;
    private DeploymentMode deploymentMode = DeploymentMode.GITOPS;
    private EphemeralSpec ephemeral;

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

    public String getSchedule() {
        return schedule;
    }

    public void setSchedule(String schedule) {
        this.schedule = schedule;
    }

    public ResilienceSpec getResilience() {
        return resilience;
    }

    public void setResilience(ResilienceSpec resilience) {
        this.resilience = resilience;
    }

    public AlertingSpec getAlerting() {
        return alerting;
    }

    public void setAlerting(AlertingSpec alerting) {
        this.alerting = alerting;
    }

    public RolloutSpec getRollout() {
        return rollout;
    }

    public void setRollout(RolloutSpec rollout) {
        this.rollout = rollout;
    }

    public String getDesiredState() {
        return desiredState;
    }

    public void setDesiredState(String desiredState) {
        this.desiredState = desiredState;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public java.util.List<String> getEditors() {
        return editors;
    }

    public void setEditors(java.util.List<String> editors) {
        this.editors = editors;
    }

    public java.util.List<String> getViewers() {
        return viewers;
    }

    public void setViewers(java.util.List<String> viewers) {
        this.viewers = viewers;
    }

    public java.util.List<SecretRef> getSecrets() {
        return secrets;
    }

    public void setSecrets(java.util.List<SecretRef> secrets) {
        this.secrets = secrets;
    }

    public DeploymentMode getDeploymentMode() {
        return deploymentMode != null ? deploymentMode : DeploymentMode.GITOPS;
    }

    public void setDeploymentMode(DeploymentMode deploymentMode) {
        this.deploymentMode = deploymentMode;
    }

    public EphemeralSpec getEphemeral() {
        return ephemeral;
    }

    public void setEphemeral(EphemeralSpec ephemeral) {
        this.ephemeral = ephemeral;
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
