package io.platform.service;

import io.platform.api.v1alpha1.EngineType;
import io.platform.api.v1alpha1.IntegrationType;
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

        assertNotNull(result.kaotoConfig());
        assertTrue(result.kaotoConfig().contains("schemaVersion"));
        assertNotNull(result.otelDecoratorJava());
        assertTrue(result.otelDecoratorJava().contains("kaoto.node.id"));
        assertNotNull(result.kustomizeBase());
        assertTrue(result.kustomizeBase().contains("Kustomization"));
    }

    @Test
    void testScaffoldSonataFlowProject() {
        String design = "id: test-workflow\nversion: '1.0'\nspecVersion: '0.8'";

        var result = scaffoldingService.scaffold(EngineType.SONATAFLOW, design);

        assertNotNull(result);
        assertTrue(result.pomXml().contains("kogito-quarkus-serverless-workflow"));
        assertTrue(result.projectStructureSummary().contains("SONATAFLOW"));
    }

    @Test
    void testScaffoldWithNullDesign() {
        var result = scaffoldingService.scaffold(EngineType.CAMEL, null);
        assertNotNull(result);
        assertNotNull(result.pomXml());
    }

    @Test
    void testScaffoldCamelRoute() {
        var result = scaffoldingService.scaffold(IntegrationType.CAMEL_ROUTE, null);

        assertNotNull(result);
        assertTrue(result.pomXml().contains("camel-quarkus-core"));
        assertTrue(result.pomXml().contains("camel-quarkus-yaml-dsl"));
        assertFalse(result.pomXml().contains("camel-quarkus-kamelet"));
        assertTrue(result.projectStructureSummary().contains("CAMEL_ROUTE"));
        assertTrue(result.workflowDefinition().contains("route:"));
    }

    @Test
    void testScaffoldCamelKamelet() {
        var result = scaffoldingService.scaffold(IntegrationType.CAMEL_KAMELET, null);

        assertNotNull(result);
        assertTrue(result.pomXml().contains("camel-quarkus-kamelet"));
        assertTrue(result.pomXml().contains("camel-quarkus-core"));
        assertTrue(result.projectStructureSummary().contains("CAMEL_KAMELET"));
        assertTrue(result.workflowDefinition().contains("kind: Kamelet"));
    }

    @Test
    void testScaffoldCamelPipe() {
        var result = scaffoldingService.scaffold(IntegrationType.CAMEL_PIPE, null);

        assertNotNull(result);
        assertTrue(result.pomXml().contains("<maven.compiler.release>17</maven.compiler.release>"));
        assertTrue(result.pomXml().contains("quarkus-maven-plugin"));
        assertTrue(result.dockerfileJvm().contains("COPY target/quarkus-app"));
        assertTrue(result.pomXml().contains("camel-quarkus-kamelet"));
        assertTrue(result.projectStructureSummary().contains("CAMEL_PIPE"));
        assertTrue(result.workflowDefinition().contains("kind: Pipe"));
    }

    @Test
    void testScaffoldCamelTest() {
        var result = scaffoldingService.scaffold(IntegrationType.CAMEL_TEST, null);

        assertNotNull(result);
        assertTrue(result.pomXml().contains("camel-quarkus-mock"));
        assertTrue(result.pomXml().contains("quarkus-junit5"));
        assertTrue(result.projectStructureSummary().contains("CAMEL_TEST"));
        assertTrue(result.workflowDefinition().contains("kind: TestCase"));
    }

    @Test
    void testScaffoldSonataFlowViaIntegrationType() {
        var result = scaffoldingService.scaffold(IntegrationType.SONATAFLOW, null);

        assertNotNull(result);
        assertTrue(result.pomXml().contains("kogito-quarkus-serverless-workflow"));
        assertTrue(result.projectStructureSummary().contains("SONATAFLOW"));
    }

    @Test
    void testEngineTypeBackwardCompat() {
        var viaEngine = scaffoldingService.scaffold(EngineType.CAMEL, null);
        var viaType = scaffoldingService.scaffold(IntegrationType.CAMEL_ROUTE, null);

        assertEquals(viaEngine.pomXml(), viaType.pomXml());
    }

    @Test
    void testIntegrationTypeCamelCheck() {
        assertTrue(IntegrationType.CAMEL_ROUTE.isCamel());
        assertTrue(IntegrationType.CAMEL_KAMELET.isCamel());
        assertTrue(IntegrationType.CAMEL_PIPE.isCamel());
        assertTrue(IntegrationType.CAMEL_TEST.isCamel());
        assertFalse(IntegrationType.SONATAFLOW.isCamel());
    }

    @Test
    void testIntegrationTypeToEngineType() {
        assertEquals(EngineType.CAMEL, IntegrationType.CAMEL_ROUTE.toEngineType());
        assertEquals(EngineType.CAMEL, IntegrationType.CAMEL_KAMELET.toEngineType());
        assertEquals(EngineType.CAMEL, IntegrationType.CAMEL_PIPE.toEngineType());
        assertEquals(EngineType.CAMEL, IntegrationType.CAMEL_TEST.toEngineType());
        assertEquals(EngineType.SONATAFLOW, IntegrationType.SONATAFLOW.toEngineType());
    }

    @Test
    void testFromEngineType() {
        assertEquals(IntegrationType.CAMEL_ROUTE, IntegrationType.fromEngineType(EngineType.CAMEL));
        assertEquals(IntegrationType.SONATAFLOW, IntegrationType.fromEngineType(EngineType.SONATAFLOW));
        assertEquals(IntegrationType.CAMEL_ROUTE, IntegrationType.fromEngineType(null));
    }
}
