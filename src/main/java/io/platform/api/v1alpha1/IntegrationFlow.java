package io.platform.api.v1alpha1;

import io.fabric8.kubernetes.api.model.Namespaced;
import io.fabric8.kubernetes.client.CustomResource;
import io.fabric8.kubernetes.model.annotation.Group;
import io.fabric8.kubernetes.model.annotation.ShortNames;
import io.fabric8.kubernetes.model.annotation.Version;

@Group("platform.io")
@Version("v1alpha1")
@ShortNames("iflow")
public class IntegrationFlow extends CustomResource<IntegrationFlowSpec, IntegrationFlowStatus>
        implements Namespaced {

    @Override
    protected IntegrationFlowSpec initSpec() {
        return new IntegrationFlowSpec();
    }

    @Override
    protected IntegrationFlowStatus initStatus() {
        return new IntegrationFlowStatus();
    }
}
