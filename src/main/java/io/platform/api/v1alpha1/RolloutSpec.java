package io.platform.api.v1alpha1;

public class RolloutSpec {

    private String type = "rolling";
    private Integer canaryWeight;
    private Integer canarySteps;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Integer getCanaryWeight() {
        return canaryWeight;
    }

    public void setCanaryWeight(Integer canaryWeight) {
        this.canaryWeight = canaryWeight;
    }

    public Integer getCanarySteps() {
        return canarySteps;
    }

    public void setCanarySteps(Integer canarySteps) {
        this.canarySteps = canarySteps;
    }
}
