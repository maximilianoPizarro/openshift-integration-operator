package io.platform.ephemeral;

import io.platform.api.v1alpha1.IntegrationFlowStatus;

public interface SonataFlowEphemeralDeployer {
    String deploy(String flowName, String namespace, String kaotoDesign, IntegrationFlowStatus status);
}
