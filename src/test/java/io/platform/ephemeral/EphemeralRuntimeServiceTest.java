package io.platform.ephemeral;

import io.platform.api.v1alpha1.IntegrationFlowSpec;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import io.platform.api.v1alpha1.IntegrationType;
import io.platform.service.ScaffoldingService;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
class EphemeralRuntimeServiceTest {

    @Inject
    EphemeralRuntimeService ephemeralRuntimeService;

    @Test
    void deployCamelRouteReturnsWorkerRef() {
        var scaffold = new ScaffoldingService.ScaffoldResult(
                "<project/>",
                "- route:\n    id: test\n    from:\n      uri: timer:tick",
                "camel-route");
        var spec = new IntegrationFlowSpec();
        var status = new IntegrationFlowStatus();

        var result = ephemeralRuntimeService.deploy(
                IntegrationType.CAMEL_ROUTE,
                "ephemeral-test-" + System.nanoTime(),
                "openshift-integration",
                scaffold,
                spec,
                status);

        assertTrue(result.success());
        assertNotNull(result.workerRef());
        assertTrue(result.workerRef().contains("deployment/") || result.workerRef().contains("ephemeral-test-route"));
    }
}
