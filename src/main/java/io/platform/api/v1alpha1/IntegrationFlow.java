package io.platform.api.v1alpha1;

import io.fabric8.kubernetes.api.model.Namespaced;
import io.fabric8.kubernetes.client.CustomResource;
import io.fabric8.kubernetes.model.annotation.Group;
import io.fabric8.kubernetes.model.annotation.ShortNames;
import io.fabric8.kubernetes.model.annotation.Version;

import java.util.ArrayList;

@Group("platform.io")
@Version("v1alpha1")
@ShortNames("iflow")
public class IntegrationFlow extends CustomResource<IntegrationFlowSpec, IntegrationFlowStatus>
        implements Namespaced {

    @Override
    protected IntegrationFlowSpec initSpec() {
        IntegrationFlowSpec spec = new IntegrationFlowSpec();
        spec.setBranch("main");
        spec.setTargeting(new TargetingSpec());
        return spec;
    }

    @Override
    protected IntegrationFlowStatus initStatus() {
        IntegrationFlowStatus status = new IntegrationFlowStatus();
        status.setConditions(new ArrayList<>());
        status.setClusterDeployments(new ArrayList<>());
        return status;
    }
}
