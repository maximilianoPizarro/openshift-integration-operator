package io.platform.ephemeral;

import io.platform.api.v1alpha1.IntegrationType;
import io.platform.service.CamelComponentDetector;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class EphemeralWorkerImageResolverTest {

    private final CamelComponentDetector detector = new CamelComponentDetector();

    @Test
    void publicApiFlowResolvesToHttpWorker() throws Exception {
        String design = """
                - route:
                    id: publicapi-bitcoin-price-poll
                    from:
                      uri: "timer:bitcoin"
                      steps:
                        - to:
                            uri: "https://open.er-api.com/v6/latest/USD"
                        - unmarshal:
                            json: {}
                        - setProperty:
                            name: rate
                            jsonpath:
                              expression: "$.rates.EUR"
                """;

        var components = detector.detectComponents(design);
        assertTrue(components.contains("timer"));
        assertTrue(components.contains("http"));
        assertTrue(components.contains("jsonpath"));
        assertTrue(components.contains("jackson"));
        assertFalse(components.contains("https"));

        var resolver = new EphemeralWorkerImageResolver();
        setField(resolver, "preferFullWorker", false);
        setField(resolver, "coreImage", "core");
        setField(resolver, "httpImage", "http");
        setField(resolver, "fullImage", "full");

        assertEquals("http", resolver.resolveWorkerImage(components, IntegrationType.CAMEL_ROUTE));
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }
}
