package io.platform.ephemeral;

import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.platform.api.v1alpha1.IntegrationFlow;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EphemeralOwnerReferenceHelperTest {

    @Test
    void buildOwnerReferenceFromFlow() {
        IntegrationFlow flow = new IntegrationFlow();
        flow.setMetadata(new ObjectMetaBuilder()
                .withName("ephemeral-demo")
                .withNamespace("openshift-integration")
                .withUid("abc-123-def")
                .build());

        var ownerRef = EphemeralOwnerReferenceHelper.build(flow);

        assertNotNull(ownerRef);
        assertEquals(EphemeralOwnerReferenceHelper.API_VERSION, ownerRef.getApiVersion());
        assertEquals(EphemeralOwnerReferenceHelper.KIND, ownerRef.getKind());
        assertEquals("ephemeral-demo", ownerRef.getName());
        assertEquals("abc-123-def", ownerRef.getUid());
        assertTrue(ownerRef.getController());
        assertTrue(ownerRef.getBlockOwnerDeletion());
    }

    @Test
    void buildReturnsNullWithoutUid() {
        IntegrationFlow flow = new IntegrationFlow();
        flow.setMetadata(new ObjectMetaBuilder()
                .withName("ephemeral-demo")
                .withNamespace("openshift-integration")
                .build());

        assertNull(EphemeralOwnerReferenceHelper.build(flow));
    }

    @Test
    void canUseOwnerReferenceOnlyInSameNamespace() {
        assertTrue(EphemeralOwnerReferenceHelper.canUseOwnerReference(
                "openshift-integration", "openshift-integration"));
        assertFalse(EphemeralOwnerReferenceHelper.canUseOwnerReference(
                "kogito-bpm", "openshift-integration"));
    }
}
