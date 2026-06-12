package io.platform.ephemeral;

import io.platform.api.v1alpha1.EphemeralSpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertTrue;

class EphemeralConfigMergerTest {

    EphemeralConfigMerger merger;

    @BeforeEach
    void setUp() {
        merger = new EphemeralConfigMerger();
        merger.componentRegistry = new ComponentPropertiesRegistry();
    }

    @Test
    void merge_includesUserQuarkusModelPropertiesFromCr() {
        EphemeralSpec spec = new EphemeralSpec();
        spec.setProperties(Map.of(
                "quarkus.langchain4j.openai.api-key", "${OPENAI_API_KEY}",
                "quarkus.langchain4j.openai.chat-model.model-name", "gpt-4o-mini"));

        String result = merger.merge(Set.of("langchain4j-chat"), null, spec, null);

        assertTrue(result.contains("quarkus.langchain4j.openai.chat-model.model-name=gpt-4o-mini"));
        assertTrue(result.contains("camel.main.routes-include-pattern=file:/deployments/config/flow.camel.yaml"));
    }
}
