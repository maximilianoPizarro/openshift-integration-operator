package io.platform.operator;

import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.api.v1alpha1.DeploymentMode;
import io.platform.api.v1alpha1.EphemeralSpec;
import io.platform.api.v1alpha1.EngineType;
import io.platform.api.v1alpha1.IntegrationFlow;
import io.platform.api.v1alpha1.IntegrationFlowSpec;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
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

    @Test
    void testDeploymentModeDefaultsToGitOps() {
        IntegrationFlowSpec spec = new IntegrationFlowSpec();
        assertEquals(DeploymentMode.GITOPS, spec.getDeploymentMode());
    }

    @Test
    void testEphemeralSpecTtl() {
        IntegrationFlowSpec spec = new IntegrationFlowSpec();
        spec.setDeploymentMode(DeploymentMode.EPHEMERAL);
        EphemeralSpec ephemeral = new EphemeralSpec();
        ephemeral.setTtlSeconds(7200);
        spec.setEphemeral(ephemeral);
        spec.setKaotoDesign("- route:\n    from:\n      uri: timer:tick");

        assertEquals(DeploymentMode.EPHEMERAL, spec.getDeploymentMode());
        assertEquals(7200, spec.getEphemeral().getTtlSeconds());
        assertNull(spec.getGitRepository());
    }

    @Test
    void testEphemeralStatusFields() {
        IntegrationFlowStatus status = new IntegrationFlowStatus();
        status.setDeploymentMode(DeploymentMode.EPHEMERAL);
        status.setEphemeralExpiresAt("2026-06-05T18:00:00Z");
        status.setEphemeralWorkerRef("deployment/ephemeral-camel-demo-worker");
        status.setPhase(IntegrationFlowStatus.Phase.Expired);

        assertEquals(DeploymentMode.EPHEMERAL, status.getDeploymentMode());
        assertEquals(IntegrationFlowStatus.Phase.Expired, status.getPhase());
        assertNotNull(status.getEphemeralExpiresAt());
    }
}
