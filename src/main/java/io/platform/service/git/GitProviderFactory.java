package io.platform.service.git;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class GitProviderFactory {

    @Inject
    GiteaGitProvider gitea;

    @Inject
    GitHubGitProvider github;

    @Inject
    GitLabGitProvider gitlab;

    public GitProvider getProvider(String repositoryUrl, String explicitProvider) {
        if (explicitProvider != null && !explicitProvider.isBlank() && !"auto".equals(explicitProvider)) {
            switch (explicitProvider.toLowerCase()) {
                case "github": return github;
                case "gitlab": return gitlab;
                case "gitea": return gitea;
                default: break;
            }
        }
        if (github.supports(repositoryUrl)) return github;
        if (gitlab.supports(repositoryUrl)) return gitlab;
        return gitea;
    }
}
