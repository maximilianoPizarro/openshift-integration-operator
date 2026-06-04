package io.platform.service;

import io.platform.service.git.GitProvider;
import io.platform.service.git.GitProviderFactory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@ApplicationScoped
public class DefaultGitOpsService implements GitOpsService {

    private static final Logger LOG = Logger.getLogger(DefaultGitOpsService.class);

    @Inject
    GitProviderFactory factory;

    @ConfigProperty(name = "git.provider", defaultValue = "auto")
    String gitProvider;

    @Override
    public GitPushResult pushScaffold(String gitRepository, String branch,
                                       ScaffoldingService.ScaffoldResult scaffoldResult) {
        LOG.infof("Pushing scaffold to %s branch=%s provider=%s", gitRepository, branch, gitProvider);

        try {
            String[] ownerRepo = extractOwnerAndRepo(gitRepository);
            String owner = ownerRepo[0];
            String repoName = ownerRepo[1];

            GitProvider provider = factory.getProvider(gitRepository, gitProvider);
            provider.ensureRepoExists(owner, repoName);

            String workflowPath = scaffoldResult.projectStructureSummary().contains("CAMEL")
                    ? "src/main/resources/routes/flow.camel.yaml"
                    : "src/main/resources/workflows/flow.sw.yaml";

            provider.createOrUpdateFile(owner, repoName, branch, "pom.xml",
                    scaffoldResult.pomXml(), "Scaffold: update pom.xml");
            provider.createOrUpdateFile(owner, repoName, branch, workflowPath,
                    scaffoldResult.workflowDefinition(), "Scaffold: update workflow definition");
            provider.createOrUpdateFile(owner, repoName, branch, "kaoto-config.json",
                    scaffoldResult.kaotoConfig(), "Scaffold: update kaoto-config.json");
            provider.createOrUpdateFile(owner, repoName, branch,
                    "src/main/java/io/platform/integration/KaotoOtelDecorator.java",
                    scaffoldResult.otelDecoratorJava(), "Scaffold: update KaotoOtelDecorator.java");
            provider.createOrUpdateFile(owner, repoName, branch, "base/kustomization.yaml",
                    scaffoldResult.kustomizeBase(), "Scaffold: update kustomization.yaml");
            provider.createOrUpdateFile(owner, repoName, branch, "src/main/resources/application.properties",
                    scaffoldResult.applicationProperties(), "Scaffold: update application.properties");

            String commitHash = provider.getLatestCommitHash(owner, repoName, branch);
            LOG.infof("Scaffold pushed successfully via %s, commit=%s", provider.getClass().getSimpleName(), commitHash);

            return new GitPushResult(commitHash, true, "Scaffold pushed via " + provider.getClass().getSimpleName());

        } catch (Exception e) {
            LOG.errorf(e, "Failed to push scaffold");
            return new GitPushResult("", false, "Git push failed: " + e.getMessage());
        }
    }

    private String[] extractOwnerAndRepo(String gitRepository) {
        if (gitRepository == null || gitRepository.isBlank()) {
            return new String[]{"", "unknown-repo"};
        }
        String path = gitRepository.replaceAll("\\.git$", "");
        path = path.replaceAll("^https?://[^/]+/", "");
        String[] parts = path.split("/");
        if (parts.length >= 2) {
            return new String[]{parts[parts.length - 2], parts[parts.length - 1]};
        }
        return new String[]{"", parts[0]};
    }
}
