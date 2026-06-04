package io.platform.service;

import io.platform.api.v1alpha1.EngineType;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class ScaffoldingServiceTest {

    @Inject
    ScaffoldingService scaffoldingService;

    @Test
    void testScaffoldCamelProject() {
        String design = "- route:\n    id: test-route\n    from:\n      uri: timer:tick\n    steps:\n      - log: Hello";

        var result = scaffoldingService.scaffold(EngineType.CAMEL, design);

        assertNotNull(result);
        assertNotNull(result.pomXml());
        assertTrue(result.pomXml().contains("camel"));
        assertNotNull(result.workflowDefinition());
        assertTrue(result.projectStructureSummary().contains("CAMEL"));

        // New fields
        assertNotNull(result.kaotoConfig());
        assertTrue(result.kaotoConfig().contains("schemaVersion"));
        assertNotNull(result.otelDecoratorJava());
        assertTrue(result.otelDecoratorJava().contains("kaoto.node.id"));
        assertNotNull(result.kustomizeBase());
        assertTrue(result.kustomizeBase().contains("kustomization"));
    }

    @Test
    void testScaffoldSonataFlowProject() {
        String design = "id: test-workflow\nversion: '1.0'\nspecVersion: '0.8'";

        var result = scaffoldingService.scaffold(EngineType.SONATAFLOW, design);

        assertNotNull(result);
        assertTrue(result.pomXml().contains("sonataflow"));
        assertTrue(result.projectStructureSummary().contains("SONATAFLOW"));
    }

    @Test
    void testScaffoldWithNullDesign() {
        var result = scaffoldingService.scaffold(EngineType.CAMEL, null);
        assertNotNull(result);
        assertNotNull(result.pomXml());
    }
}
