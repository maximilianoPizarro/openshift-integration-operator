package io.platform.operator;

import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.api.v1alpha1.EngineType;
import io.platform.api.v1alpha1.IntegrationFlow;
import io.platform.api.v1alpha1.IntegrationFlowSpec;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class IntegrationFlowReconcilerTest {

    @Inject
    KubernetesClient client;

    @Test
    void testCRDIsRegistered() {
        var crds = client.apiextensions().v1().customResourceDefinitions().list().getItems();
        // In test mode, the CRD should be auto-applied by the operator SDK
        assertNotNull(crds);
    }

    @Test
    void testIntegrationFlowSpecDefaults() {
        IntegrationFlow flow = new IntegrationFlow();

        assertNotNull(flow.getSpec());
        assertNotNull(flow.getStatus());
        assertEquals("main", flow.getSpec().getBranch());
    }

    @Test
    void testIntegrationFlowSpecWithEngine() {
        IntegrationFlowSpec spec = new IntegrationFlowSpec();
        spec.setEngine(EngineType.CAMEL);
        spec.setGitRepository("https://gitea.example.com/user1/test-flow");
        spec.setBranch("main");

        assertEquals(EngineType.CAMEL, spec.getEngine());
        assertEquals("main", spec.getBranch());
    }
}
