package io.platform.ephemeral;

import io.platform.api.v1alpha1.IntegrationFlowSpec;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import io.platform.api.v1alpha1.IntegrationType;
import io.platform.service.ScaffoldingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EphemeralRuntimeServiceTest {

    private CamelRouteEphemeralDeployer camelRouteDeployer;
    private CamelKEphemeralDeployer camelKDeployer;
    private CamelTestEphemeralDeployer camelTestDeployer;
    private SonataFlowEphemeralDeployer sonataFlowDeployer;
    private EphemeralRuntimeService service;

    @BeforeEach
    void setUp() {
        camelRouteDeployer = mock(CamelRouteEphemeralDeployer.class);
        camelKDeployer = mock(CamelKEphemeralDeployer.class);
        camelTestDeployer = mock(CamelTestEphemeralDeployer.class);
        sonataFlowDeployer = mock(SonataFlowEphemeralDeployer.class);

        service = new EphemeralRuntimeService();
        service.camelRouteDeployer = camelRouteDeployer;
        service.camelKDeployer = camelKDeployer;
        service.camelTestDeployer = camelTestDeployer;
        service.sonataFlowDeployer = sonataFlowDeployer;
    }

    @Test
    void deployCamelRouteReturnsWorkerRef() {
        when(camelRouteDeployer.deploy(anyString(), anyString(), any()))
                .thenReturn("deployment/iflow-demo-worker");

        var scaffold = new ScaffoldingService.ScaffoldResult(
                "<project/>",
                "- route:\n    id: test\n    from:\n      uri: timer:tick",
                "camel-route");

        var result = service.deploy(
                IntegrationType.CAMEL_ROUTE,
                "demo",
                "openshift-integration",
                scaffold,
                new IntegrationFlowSpec(),
                new IntegrationFlowStatus());

        assertTrue(result.success());
        assertEquals("deployment/iflow-demo-worker", result.workerRef());
        verify(camelRouteDeployer).deploy(eq("demo"), eq("openshift-integration"), eq(scaffold));
    }

    @Test
    void deployCamelKameletUsesCamelKWhenAvailable() {
        when(camelKDeployer.isCamelKAvailable()).thenReturn(true);
        when(camelKDeployer.deploy(anyString(), anyString(), eq(IntegrationType.CAMEL_KAMELET), anyString()))
                .thenReturn("kamelet/demo");

        var spec = new IntegrationFlowSpec();
        spec.setKaotoDesign("apiVersion: camel.apache.org/v1\nkind: Kamelet");

        var result = service.deploy(
                IntegrationType.CAMEL_KAMELET,
                "demo",
                "openshift-integration",
                mock(ScaffoldingService.ScaffoldResult.class),
                spec,
                new IntegrationFlowStatus());

        assertEquals("kamelet/demo", result.workerRef());
    }
}
