package io.platform.api.v1alpha1;

public class EphemeralSpec {

    private Integer ttlSeconds;

    public Integer getTtlSeconds() {
        return ttlSeconds;
    }

    public void setTtlSeconds(Integer ttlSeconds) {
        this.ttlSeconds = ttlSeconds;
    }
}
