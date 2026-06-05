package io.platform.api.v1alpha1;

public class ResilienceSpec {

    private RetrySpec retry;
    private CircuitBreakerSpec circuitBreaker;
    private Integer maxInflightExchanges;

    public RetrySpec getRetry() {
        return retry;
    }

    public void setRetry(RetrySpec retry) {
        this.retry = retry;
    }

    public CircuitBreakerSpec getCircuitBreaker() {
        return circuitBreaker;
    }

    public void setCircuitBreaker(CircuitBreakerSpec circuitBreaker) {
        this.circuitBreaker = circuitBreaker;
    }

    public Integer getMaxInflightExchanges() {
        return maxInflightExchanges;
    }

    public void setMaxInflightExchanges(Integer maxInflightExchanges) {
        this.maxInflightExchanges = maxInflightExchanges;
    }

    public static class RetrySpec {

        private Integer maxAttempts = 3;
        private String backoff = "exponential";
        private String initialDelay = "1s";
        private String maxDelay = "30s";

        public Integer getMaxAttempts() {
            return maxAttempts;
        }

        public void setMaxAttempts(Integer maxAttempts) {
            this.maxAttempts = maxAttempts;
        }

        public String getBackoff() {
            return backoff;
        }

        public void setBackoff(String backoff) {
            this.backoff = backoff;
        }

        public String getInitialDelay() {
            return initialDelay;
        }

        public void setInitialDelay(String initialDelay) {
            this.initialDelay = initialDelay;
        }

        public String getMaxDelay() {
            return maxDelay;
        }

        public void setMaxDelay(String maxDelay) {
            this.maxDelay = maxDelay;
        }
    }

    public static class CircuitBreakerSpec {

        private Integer failureThreshold = 5;
        private String halfOpenAfter = "30s";
        private Integer successThreshold = 3;

        public Integer getFailureThreshold() {
            return failureThreshold;
        }

        public void setFailureThreshold(Integer failureThreshold) {
            this.failureThreshold = failureThreshold;
        }

        public String getHalfOpenAfter() {
            return halfOpenAfter;
        }

        public void setHalfOpenAfter(String halfOpenAfter) {
            this.halfOpenAfter = halfOpenAfter;
        }

        public Integer getSuccessThreshold() {
            return successThreshold;
        }

        public void setSuccessThreshold(Integer successThreshold) {
            this.successThreshold = successThreshold;
        }
    }
}
