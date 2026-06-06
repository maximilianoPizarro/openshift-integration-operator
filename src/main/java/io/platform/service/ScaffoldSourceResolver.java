package io.platform.service;

import io.platform.api.v1alpha1.IntegrationType;
import io.platform.service.git.GitUrlResolver;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class ScaffoldSourceResolver {

    @Inject
    GitUrlResolver gitUrlResolver;

    @ConfigProperty(name = "scaffolds.source", defaultValue = "embedded")
    String scaffoldSource;

    public boolean useEmbeddedScaffold(String gitRepository) {
        if (!"embedded".equalsIgnoreCase(scaffoldSource)) {
            return false;
        }
        if (gitRepository == null || gitRepository.isBlank()) {
            return true;
        }
        if (gitUrlResolver.isPlaceholderOrEmpty(gitRepository)) {
            // When a real Git provider is configured, placeholder hosts are rewritten and Git is used.
            return gitUrlResolver.resolve(gitRepository).equals(gitRepository);
        }
        return false;
    }

    public String scaffoldConfigMapName(IntegrationType type) {
        return "scaffold-" + toScaffoldKey(type);
    }

    public static String toScaffoldKey(IntegrationType type) {
        if (type == null) {
            return "camel-route";
        }
        return switch (type) {
            case CAMEL_ROUTE -> "camel-route";
            case CAMEL_KAMELET -> "camel-kamelet";
            case CAMEL_PIPE -> "camel-pipe";
            case CAMEL_TEST -> "camel-test";
            case SONATAFLOW -> "sonataflow";
        };
    }

    public static String toPipelineParam(IntegrationType type) {
        if (type == null) {
            return "camelRoute";
        }
        return switch (type) {
            case CAMEL_ROUTE -> "camelRoute";
            case CAMEL_KAMELET -> "camelKamelet";
            case CAMEL_PIPE -> "camelPipe";
            case CAMEL_TEST -> "camelTest";
            case SONATAFLOW -> "sonataflow";
        };
    }
}
