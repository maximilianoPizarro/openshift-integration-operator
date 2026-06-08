package io.platform.api.v1alpha1;

import java.util.List;
import java.util.Map;

public class EphemeralSpec {

    private Integer ttlSeconds;
    private String workerImage;
    private Map<String, String> properties;
    private List<String> disableProperties;

    public Integer getTtlSeconds() {
        return ttlSeconds;
    }

    public void setTtlSeconds(Integer ttlSeconds) {
        this.ttlSeconds = ttlSeconds;
    }

    public String getWorkerImage() {
        return workerImage;
    }

    public void setWorkerImage(String workerImage) {
        this.workerImage = workerImage;
    }

    public Map<String, String> getProperties() {
        return properties;
    }

    public void setProperties(Map<String, String> properties) {
        this.properties = properties;
    }

    public List<String> getDisableProperties() {
        return disableProperties;
    }

    public void setDisableProperties(List<String> disableProperties) {
        this.disableProperties = disableProperties;
    }
}
