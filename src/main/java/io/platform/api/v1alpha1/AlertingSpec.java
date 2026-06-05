package io.platform.api.v1alpha1;

public class AlertingSpec {

    private Double errorRateThreshold = 0.05;
    private String latencyP99Threshold = "5s";
    private boolean enabled = true;

    public Double getErrorRateThreshold() {
        return errorRateThreshold;
    }

    public void setErrorRateThreshold(Double errorRateThreshold) {
        this.errorRateThreshold = errorRateThreshold;
    }

    public String getLatencyP99Threshold() {
        return latencyP99Threshold;
    }

    public void setLatencyP99Threshold(String latencyP99Threshold) {
        this.latencyP99Threshold = latencyP99Threshold;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
