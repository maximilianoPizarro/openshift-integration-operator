package io.platform.ephemeral;

import io.fabric8.kubernetes.api.model.OwnerReference;
import io.platform.api.v1alpha1.IntegrationFlow;
import io.platform.api.v1alpha1.IntegrationFlowSpec;
import io.platform.api.v1alpha1.IntegrationFlowStatus;
import io.platform.api.v1alpha1.IntegrationType;
import io.platform.service.ScaffoldingService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

@ApplicationScoped
public class EphemeralRuntimeService {

    private static final Logger LOG = Logger.getLogger(EphemeralRuntimeService.class);

    @Inject
    CamelRouteEphemeralDeployer camelRouteDeployer;

    @Inject
    CamelKEphemeralDeployer camelKDeployer;

    @Inject
    CamelTestEphemeralDeployer camelTestDeployer;

    @Inject
    SonataFlowEphemeralDeployer sonataFlowDeployer;

    public DeployResult deploy(IntegrationType type, IntegrationFlow flow,
                               ScaffoldingService.ScaffoldResult scaffold,
                               IntegrationFlowSpec spec, IntegrationFlowStatus status) {
        String flowName = flow.getMetadata().getName();
        String namespace = flow.getMetadata().getNamespace();
        OwnerReference ownerRef = EphemeralOwnerReferenceHelper.build(flow);

        var ephemeral = spec.getEphemeral();
        String imageOverride = ephemeral != null ? ephemeral.getWorkerImage() : null;
        var secrets = spec.getSecrets();
        var resilience = spec.getResilience();

        String workerRef = switch (type) {
            case CAMEL_ROUTE -> camelRouteDeployer.deploy(flowName, namespace, scaffold,
                    IntegrationType.CAMEL_ROUTE, imageOverride, ephemeral, resilience, secrets, ownerRef);
            case CAMEL_KAMELET, CAMEL_PIPE -> {
                if (!camelKDeployer.isCamelKAvailable()) {
                    yield camelRouteDeployer.deploy(flowName, namespace, scaffold,
                            type, imageOverride, ephemeral, resilience, secrets, ownerRef);
                }
                yield camelKDeployer.deploy(flowName, namespace, type, spec.getKaotoDesign(), ownerRef);
            }
            case CAMEL_TEST -> camelTestDeployer.deploy(flowName, namespace, scaffold, ownerRef);
            case SONATAFLOW -> sonataFlowDeployer.deploy(flowName, namespace, spec.getKaotoDesign(), status);
        };
        LOG.infof("Ephemeral deploy complete for %s: %s", flowName, workerRef);
        return new DeployResult(workerRef, true, "Ephemeral resources deployed");
    }

    public record DeployResult(String workerRef, boolean success, String message) {}
}
