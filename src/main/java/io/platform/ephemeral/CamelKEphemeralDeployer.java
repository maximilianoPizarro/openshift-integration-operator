package io.platform.ephemeral;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.fabric8.kubernetes.api.model.GenericKubernetesResource;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.api.model.OwnerReference;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.platform.api.v1alpha1.IntegrationType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Map;

@ApplicationScoped
public class CamelKEphemeralDeployer {

    private static final Logger LOG = Logger.getLogger(CamelKEphemeralDeployer.class);

    @Inject
    KubernetesClient kubernetesClient;

    public boolean isCamelKAvailable() {
        try {
            return kubernetesClient.apiextensions().v1().customResourceDefinitions()
                    .withName("kamelets.camel.apache.org").get() != null;
        } catch (Exception e) {
            return false;
        }
    }

    public String deploy(String flowName, String namespace, IntegrationType type, String kaotoDesign) {
        return deploy(flowName, namespace, type, kaotoDesign, null);
    }

    public String deploy(String flowName, String namespace, IntegrationType type, String kaotoDesign,
                         OwnerReference ownerRef) {
        if (!isCamelKAvailable()) {
            throw new IllegalStateException(
                    "Camel K operator not installed (CRD kamelets.camel.apache.org missing). "
                            + "Install Camel K or use CAMEL_ROUTE for ephemeral try-it.");
        }

        try {
            var yamlMapper = new YAMLFactory();
            var mapper = new ObjectMapper(yamlMapper);
            @SuppressWarnings("unchecked")
            Map<String, Object> doc = mapper.readValue(kaotoDesign, Map.class);

            String kind = String.valueOf(doc.get("kind"));
            String apiVersion = doc.get("apiVersion") != null
                    ? String.valueOf(doc.get("apiVersion"))
                    : "camel.apache.org/v1";

            @SuppressWarnings("unchecked")
            Map<String, Object> metadata = (Map<String, Object>) doc.get("metadata");
            String name = metadata != null && metadata.get("name") != null
                    ? String.valueOf(metadata.get("name"))
                    : "iflow-" + flowName;

            var resource = new GenericKubernetesResource();
            resource.setApiVersion(apiVersion);
            resource.setKind(kind);
            resource.setMetadata(new ObjectMetaBuilder()
                    .withName(name)
                    .withNamespace(namespace)
                    .withLabels(CamelRouteEphemeralDeployer.ephemeralLabels(flowName))
                    .withOwnerReferences(EphemeralOwnerReferenceHelper.asList(ownerRef))
                    .build());
            resource.setAdditionalProperties(doc);
            // Ensure metadata in additional properties matches
            doc.put("apiVersion", apiVersion);
            doc.put("kind", kind);
            if (metadata != null) {
                metadata.put("name", name);
                metadata.put("namespace", namespace);
            }

            kubernetesClient.resource(resource).inNamespace(namespace).createOrReplace();
            LOG.infof("Deployed ephemeral Camel K %s/%s for flow %s", kind, name, flowName);
            return kind.toLowerCase() + "/" + name;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to deploy Camel K resource: " + e.getMessage(), e);
        }
    }
}
