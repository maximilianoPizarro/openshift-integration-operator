package io.platform.ephemeral;

public final class EphemeralResourceLabels {

    public static final String LABEL_EPHEMERAL = "platform.io/ephemeral";
    public static final String LABEL_FLOW_NAME = "platform.io/flow-name";
    public static final String LABEL_COMPONENT = "platform.io/component";
    public static final String FINALIZER = "platform.io/ephemeral-cleanup";
    public static final String ANNOTATION_EXPIRES_AT = "platform.io/ephemeral-expires-at";

    private EphemeralResourceLabels() {
    }
}
