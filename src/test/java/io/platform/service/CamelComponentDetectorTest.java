package io.platform.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CamelComponentDetectorTest {

    private final CamelComponentDetector detector = new CamelComponentDetector();

    @Test
    void detectsKafkaAndPlatformHttp() {
        String design = """
                - route:
                    from:
                      uri: "platform-http:/api/ingest"
                    steps:
                      - to:
                          uri: "kafka:events?brokers=localhost:9092"
                """;
        var components = detector.detectComponents(design);
        assertTrue(components.contains("kafka"));
        assertTrue(components.contains("platform-http"));
    }

    @Test
    void defaultsWhenEmpty() {
        var components = detector.detectComponents(null);
        assertTrue(components.contains("timer"));
        assertTrue(components.contains("log"));
    }
}
