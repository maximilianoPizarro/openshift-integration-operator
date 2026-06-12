package io.platform.lifecycle;

import io.fabric8.kubernetes.api.model.authorization.v1.ResourceAttributesBuilder;
import io.fabric8.kubernetes.api.model.authorization.v1.SelfSubjectAccessReview;
import io.fabric8.kubernetes.api.model.authorization.v1.SelfSubjectAccessReviewBuilder;
import io.fabric8.kubernetes.api.model.authentication.TokenReview;
import io.fabric8.kubernetes.api.model.authentication.TokenReviewBuilder;
import io.fabric8.kubernetes.client.Config;
import io.fabric8.kubernetes.client.ConfigBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import io.platform.api.v1alpha1.IntegrationFlow;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;

@ApplicationScoped
public class FlowAccessService {

    @Inject
    KubernetesClient operatorClient;

    public String requireToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new WebApplicationException("Missing or invalid Authorization header", 401);
        }
        String token = authHeader.substring(7).trim();
        TokenReview result = operatorClient.tokenReviews().create(
                new TokenReviewBuilder().withNewSpec().withToken(token).endSpec().build());
        if (result.getStatus() == null || !Boolean.TRUE.equals(result.getStatus().getAuthenticated())) {
            throw new WebApplicationException("Token not authenticated", 403);
        }
        return token;
    }

    public void requireFlowAccess(String token, String namespace, String verb) {
        if (!canAccessFlow(token, namespace, verb)) {
            throw new WebApplicationException("Forbidden", 403);
        }
    }

    public boolean canAccessFlow(String token, String namespace, String verb) {
        try (KubernetesClient userClient = clientForToken(token)) {
            SelfSubjectAccessReview review = new SelfSubjectAccessReviewBuilder()
                    .withNewSpec()
                    .withResourceAttributes(new ResourceAttributesBuilder()
                            .withGroup("platform.io")
                            .withResource("integrationflows")
                            .withNamespace(namespace)
                            .withVerb(verb)
                            .build())
                    .endSpec()
                    .build();
            SelfSubjectAccessReview result = userClient.authorization()
                    .v1().selfSubjectAccessReview().create(review);
            return result.getStatus() != null && Boolean.TRUE.equals(result.getStatus().getAllowed());
        }
    }

    public boolean canListAllFlows(String token) {
        try (KubernetesClient userClient = clientForToken(token)) {
            SelfSubjectAccessReview review = new SelfSubjectAccessReviewBuilder()
                    .withNewSpec()
                    .withResourceAttributes(new ResourceAttributesBuilder()
                            .withGroup("platform.io")
                            .withResource("integrationflows")
                            .withVerb("list")
                            .build())
                    .endSpec()
                    .build();
            SelfSubjectAccessReview result = userClient.authorization()
                    .v1().selfSubjectAccessReview().create(review);
            return result.getStatus() != null && Boolean.TRUE.equals(result.getStatus().getAllowed());
        }
    }

    public IntegrationFlow getFlow(String token, String namespace, String name, String verb) {
        requireFlowAccess(token, namespace, verb);
        IntegrationFlow flow = operatorClient.resources(IntegrationFlow.class)
                .inNamespace(namespace).withName(name).get();
        if (flow == null) {
            throw new WebApplicationException("Flow not found", 404);
        }
        return flow;
    }

    private KubernetesClient clientForToken(String token) {
        Config base = operatorClient.getConfiguration();
        Config userConfig = new ConfigBuilder(base).withOauthToken(token).build();
        return new KubernetesClientBuilder().withConfig(userConfig).build();
    }
}
