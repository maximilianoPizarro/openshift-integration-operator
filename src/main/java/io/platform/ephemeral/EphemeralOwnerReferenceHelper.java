package io.platform.ephemeral;

import io.fabric8.kubernetes.api.model.OwnerReference;
import io.fabric8.kubernetes.api.model.OwnerReferenceBuilder;
import io.platform.api.v1alpha1.IntegrationFlow;

import java.util.Collections;
import java.util.List;

public final class EphemeralOwnerReferenceHelper {

    public static final String API_VERSION = "platform.io/v1alpha1";
    public static final String KIND = "IntegrationFlow";

    private EphemeralOwnerReferenceHelper() {
    }

    public static OwnerReference build(IntegrationFlow flow) {
        if (flow == null || flow.getMetadata() == null) {
            return null;
        }
        String uid = flow.getMetadata().getUid();
        String name = flow.getMetadata().getName();
        if (uid == null || uid.isBlank() || name == null || name.isBlank()) {
            return null;
        }
        return new OwnerReferenceBuilder()
                .withApiVersion(API_VERSION)
                .withKind(KIND)
                .withName(name)
                .withUid(uid)
                .withController(true)
                .withBlockOwnerDeletion(true)
                .build();
    }

    public static List<OwnerReference> asList(OwnerReference ownerRef) {
        return ownerRef != null ? List.of(ownerRef) : Collections.emptyList();
    }

    public static boolean canUseOwnerReference(String resourceNamespace, String flowNamespace) {
        return resourceNamespace != null && resourceNamespace.equals(flowNamespace);
    }
}
