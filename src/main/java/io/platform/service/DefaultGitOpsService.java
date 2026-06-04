package io.platform.service;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Base64;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

@ApplicationScoped
public class DefaultGitOpsService implements GitOpsService {

    private static final Logger LOG = Logger.getLogger(DefaultGitOpsService.class);

    @ConfigProperty(name = "GITEA_URL", defaultValue = "https://gitea-gitea.apps.cluster-xtvzv.dynamic.redhatworkshops.io")
    String giteaUrl;

    @ConfigProperty(name = "GITEA_USERNAME", defaultValue = "user1")
    String giteaUsername;

    @ConfigProperty(name = "GITEA_PASSWORD", defaultValue = "Welcome123!")
    String giteaPassword;

    @ConfigProperty(name = "GITEA_ORG", defaultValue = "user1")
    String giteaOrg;

    private final HttpClient httpClient = buildTrustAllClient();

    private static HttpClient buildTrustAllClient() {
        try {
            TrustManager[] trustAll = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] c, String a) {}
                    public void checkServerTrusted(X509Certificate[] c, String a) {}
                }
            };
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAll, new SecureRandom());
            return HttpClient.newBuilder()
                    .version(HttpClient.Version.HTTP_1_1)
                    .sslContext(sc)
                    .build();
        } catch (Exception e) {
            return HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
        }
    }

    @Override
    public GitPushResult pushScaffold(String gitRepository, String branch,
                                       ScaffoldingService.ScaffoldResult scaffoldResult) {
        LOG.infof("Pushing scaffold to %s branch=%s", gitRepository, branch);

        try {
            String repoName = extractRepoName(gitRepository);
            ensureRepoExists(repoName);

            boolean isCamel = scaffoldResult.projectStructureSummary().contains("CAMEL");
            String workflowPath = isCamel
                    ? "src/main/resources/routes/flow.camel.yaml"
                    : "src/main/resources/workflows/flow.sw.yaml";

            createOrUpdateFile(repoName, branch, "pom.xml", scaffoldResult.pomXml(), "Scaffold: update pom.xml");
            createOrUpdateFile(repoName, branch, workflowPath, scaffoldResult.workflowDefinition(), "Scaffold: update workflow definition");
            createOrUpdateFile(repoName, branch, "kaoto-config.json", scaffoldResult.kaotoConfig(), "Scaffold: update kaoto-config.json");
            createOrUpdateFile(repoName, branch, "src/main/java/io/platform/integration/KaotoOtelDecorator.java",
                    scaffoldResult.otelDecoratorJava(), "Scaffold: update KaotoOtelDecorator.java");
            createOrUpdateFile(repoName, branch, "base/kustomization.yaml", scaffoldResult.kustomizeBase(), "Scaffold: update kustomization.yaml");
            createOrUpdateFile(repoName, branch, "src/main/resources/application.properties",
                    scaffoldResult.applicationProperties(), "Scaffold: update application.properties");

            String commitHash = getLatestCommitHash(repoName, branch);
            LOG.infof("Scaffold pushed successfully, commit=%s", commitHash);

            return new GitPushResult(commitHash, true, "Scaffold pushed to Gitea");

        } catch (Exception e) {
            LOG.errorf(e, "Failed to push scaffold to Gitea");
            return new GitPushResult("", false, "Git push failed: " + e.getMessage());
        }
    }

    private String extractRepoName(String gitRepository) {
        if (gitRepository == null || gitRepository.isBlank()) return "unknown-repo";
        String path = gitRepository.replaceAll("^https?://[^/]+/", "");
        String[] parts = path.split("/");
        return parts.length >= 2 ? parts[parts.length - 1] : path;
    }

    private String authHeader() {
        String credentials = giteaUsername + ":" + giteaPassword;
        return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    private void ensureRepoExists(String repoName) throws Exception {
        String checkUrl = giteaUrl + "/api/v1/repos/" + giteaOrg + "/" + repoName;
        HttpRequest check = HttpRequest.newBuilder()
                .uri(URI.create(checkUrl))
                .header("Authorization", authHeader())
                .GET()
                .build();

        HttpResponse<String> resp = httpClient.send(check, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 200) {
            LOG.infof("Repo %s/%s already exists", giteaOrg, repoName);
            return;
        }

        LOG.infof("Creating repo %s/%s", giteaOrg, repoName);
        String createBody = String.format(
                "{\"name\":\"%s\",\"description\":\"IntegrationFlow scaffolded project\",\"auto_init\":true,\"default_branch\":\"main\"}",
                repoName);

        HttpRequest create = HttpRequest.newBuilder()
                .uri(URI.create(giteaUrl + "/api/v1/user/repos"))
                .header("Authorization", authHeader())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(createBody))
                .build();

        HttpResponse<String> createResp = httpClient.send(create, HttpResponse.BodyHandlers.ofString());
        if (createResp.statusCode() != 201 && createResp.statusCode() != 200) {
            throw new RuntimeException("Failed to create repo: HTTP " + createResp.statusCode() + " " + createResp.body());
        }
        LOG.infof("Repo %s/%s created", giteaOrg, repoName);
    }

    private void createOrUpdateFile(String repoName, String branch, String filePath, String content, String commitMessage) throws Exception {
        String encodedContent = Base64.getEncoder().encodeToString(content.getBytes(StandardCharsets.UTF_8));
        String apiPath = giteaUrl + "/api/v1/repos/" + giteaOrg + "/" + repoName + "/contents/" + filePath;

        HttpRequest getFile = HttpRequest.newBuilder()
                .uri(URI.create(apiPath + "?ref=" + branch))
                .header("Authorization", authHeader())
                .GET()
                .build();
        HttpResponse<String> getResp = httpClient.send(getFile, HttpResponse.BodyHandlers.ofString());

        String body;
        if (getResp.statusCode() == 200) {
            String sha = extractJsonField(getResp.body(), "sha");
            body = String.format("{\"content\":\"%s\",\"message\":\"%s\",\"branch\":\"%s\",\"sha\":\"%s\"}",
                    encodedContent, commitMessage, branch, sha);
            HttpRequest update = HttpRequest.newBuilder()
                    .uri(URI.create(apiPath))
                    .header("Authorization", authHeader())
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> updateResp = httpClient.send(update, HttpResponse.BodyHandlers.ofString());
            if (updateResp.statusCode() != 200) {
                throw new RuntimeException("Update file failed: HTTP " + updateResp.statusCode());
            }
        } else {
            body = String.format("{\"content\":\"%s\",\"message\":\"%s\",\"branch\":\"%s\"}",
                    encodedContent, commitMessage, branch);
            HttpRequest create = HttpRequest.newBuilder()
                    .uri(URI.create(apiPath))
                    .header("Authorization", authHeader())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> createResp = httpClient.send(create, HttpResponse.BodyHandlers.ofString());
            if (createResp.statusCode() != 201 && createResp.statusCode() != 200) {
                LOG.errorf("Create file failed: HTTP %d body=%s", createResp.statusCode(), createResp.body());
                throw new RuntimeException("Create file failed: HTTP " + createResp.statusCode());
            }
        }
        LOG.infof("File %s written to %s/%s", filePath, giteaOrg, repoName);
    }

    private String getLatestCommitHash(String repoName, String branch) {
        try {
            String url = giteaUrl + "/api/v1/repos/" + giteaOrg + "/" + repoName + "/git/refs/heads/" + branch;
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", authHeader())
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                return extractJsonField(resp.body(), "sha").substring(0, 7);
            }
        } catch (Exception e) {
            LOG.warnf("Could not fetch latest commit hash: %s", e.getMessage());
        }
        return "unknown";
    }

    private static String extractJsonField(String json, String field) {
        String searchKey = "\"" + field + "\":\"";
        int start = json.indexOf(searchKey);
        if (start < 0) return "";
        start += searchKey.length();
        int end = json.indexOf("\"", start);
        return end > start ? json.substring(start, end) : "";
    }
}
