package io.platform.service;

import io.platform.api.v1alpha1.IntegrationType;
import io.platform.service.git.GitProvider;
import io.platform.service.git.GitProviderFactory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@ApplicationScoped
public class DefaultGitOpsService implements GitOpsService {

    private static final Logger LOG = Logger.getLogger(DefaultGitOpsService.class);
    private static final String INTERNAL_REGISTRY = "image-registry.openshift-image-registry.svc:5000";

    @Inject
    GitProviderFactory factory;

    @Inject
    io.platform.service.git.GitUrlResolver gitUrlResolver;

    @ConfigProperty(name = "git.provider", defaultValue = "auto")
    String gitProvider;

    @ConfigProperty(name = "platform.namespace", defaultValue = "openshift-integration")
    String platformNamespace;

    @ConfigProperty(name = "sonataflow.namespace", defaultValue = "kogito-bpm")
    String sonataFlowNamespace;

    @Override
    public GitPushResult pushScaffold(String gitRepository, String branch, String integrationFlowName,
                                      IntegrationType integrationType,
                                      ScaffoldingService.ScaffoldResult scaffoldResult) {
        String resolvedRepo = gitUrlResolver.resolve(gitRepository);
        LOG.infof("Pushing scaffold to %s branch=%s provider=%s flow=%s type=%s",
                resolvedRepo, branch, gitProvider, integrationFlowName, integrationType);

        try {
            String[] ownerRepo = extractOwnerAndRepo(resolvedRepo);
            String owner = ownerRepo[0];
            String repoName = ownerRepo[1];

            GitProvider provider = factory.getProvider(resolvedRepo, gitProvider);
            provider.ensureRepoExists(owner, repoName);

            String workflowPath = integrationType.isCamel()
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
            provider.createOrUpdateFile(owner, repoName, branch, "src/main/resources/application.properties",
                    scaffoldResult.applicationProperties(), "Scaffold: update application.properties");
            if (scaffoldResult.dockerfileJvm() != null && !scaffoldResult.dockerfileJvm().isBlank()) {
                provider.createOrUpdateFile(owner, repoName, branch, "Dockerfile",
                        scaffoldResult.dockerfileJvm(), "Scaffold: update Dockerfile");
            }

            pushGitOpsManifests(provider, owner, repoName, branch, integrationFlowName,
                    integrationType, scaffoldResult);

            String commitHash = provider.getLatestCommitHash(owner, repoName, branch);
            LOG.infof("Scaffold pushed successfully via %s, commit=%s",
                    provider.getClass().getSimpleName(), commitHash);

            return new GitPushResult(commitHash, true, "Scaffold pushed via " + provider.getClass().getSimpleName());

        } catch (Exception e) {
            LOG.errorf(e, "Failed to push scaffold");
            return new GitPushResult("", false, "Git push failed: " + e.getMessage());
        }
    }

    private void pushGitOpsManifests(GitProvider provider, String owner, String repoName, String branch,
                                     String integrationFlowName, IntegrationType integrationType,
                                     ScaffoldingService.ScaffoldResult scaffoldResult) throws Exception {
        provider.createOrUpdateFile(owner, repoName, branch, "base/kustomization.yaml",
                GitOpsManifestGenerator.kustomization(integrationFlowName, integrationType),
                "Scaffold: update kustomization.yaml");

        switch (integrationType) {
            case CAMEL_KAMELET -> provider.createOrUpdateFile(owner, repoName, branch, "base/kamelet.yaml",
                    GitOpsManifestGenerator.camelCrManifest(scaffoldResult.workflowDefinition()),
                    "Scaffold: update kamelet manifest");
            case CAMEL_PIPE -> provider.createOrUpdateFile(owner, repoName, branch, "base/pipe.yaml",
                    GitOpsManifestGenerator.camelCrManifest(scaffoldResult.workflowDefinition()),
                    "Scaffold: update pipe manifest");
            case SONATAFLOW -> provider.createOrUpdateFile(owner, repoName, branch, "base/sonataflow.yaml",
                    GitOpsManifestGenerator.sonataFlowCr(
                            integrationFlowName, sonataFlowNamespace, scaffoldResult.workflowDefinition()),
                    "Scaffold: update sonataflow manifest");
            default -> {
                String image = GitOpsManifestGenerator.workerImage(
                        INTERNAL_REGISTRY, platformNamespace, integrationFlowName, "latest");
                provider.createOrUpdateFile(owner, repoName, branch, "base/deployment.yaml",
                        GitOpsManifestGenerator.deployment(integrationFlowName, image),
                        "Scaffold: update deployment.yaml");
                provider.createOrUpdateFile(owner, repoName, branch, "base/service.yaml",
                        GitOpsManifestGenerator.service(integrationFlowName),
                        "Scaffold: update service.yaml");
            }
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
