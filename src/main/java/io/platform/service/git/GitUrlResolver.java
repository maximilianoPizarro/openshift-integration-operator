package io.platform.service.git;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.net.URI;
import java.util.Set;

@ApplicationScoped
public class GitUrlResolver {

    private static final Set<String> PLACEHOLDER_HOSTS = Set.of(
            "gitea.example.com",
            "github.example.com",
            "gitlab.example.com"
    );

    @ConfigProperty(name = "git.url")
    java.util.Optional<String> gitUrl;

    @ConfigProperty(name = "gitea.url", defaultValue = "https://gitea-gitea.apps.cluster.local")
    String giteaUrl;

    @ConfigProperty(name = "github.url", defaultValue = "https://github.com")
    String githubUrl;

    @ConfigProperty(name = "gitlab.url", defaultValue = "https://gitlab.com")
    String gitlabUrl;

    /**
     * Rewrites placeholder git hosts to the operator-configured provider URL.
     */
    public String resolve(String gitRepository) {
        if (gitRepository == null || gitRepository.isBlank()) {
            return gitRepository;
        }
        try {
            URI uri = URI.create(gitRepository.replace(" ", ""));
            String host = uri.getHost();
            if (host == null || !PLACEHOLDER_HOSTS.contains(host.toLowerCase())) {
                return gitRepository;
            }
            String baseUrl = configuredBaseUrl(host);
            if (baseUrl == null || baseUrl.isBlank()) {
                return gitRepository;
            }
            String path = uri.getRawPath();
            if (path == null || path.isBlank()) {
                path = "";
            }
            String query = uri.getRawQuery();
            String fragment = uri.getRawFragment();
            String resolved = baseUrl.replaceAll("/$", "") + path;
            if (query != null && !query.isBlank()) {
                resolved += "?" + query;
            }
            if (fragment != null && !fragment.isBlank()) {
                resolved += "#" + fragment;
            }
            return resolved;
        } catch (Exception e) {
            return gitRepository;
        }
    }

    private String configuredBaseUrl(String placeholderHost) {
        return switch (placeholderHost.toLowerCase()) {
            case "gitea.example.com" -> gitUrl != null
                    ? gitUrl.filter(u -> !u.isBlank()).orElse(giteaUrl) : giteaUrl;
            case "github.example.com" -> githubUrl;
            case "gitlab.example.com" -> gitlabUrl;
            default -> null;
        };
    }
}
