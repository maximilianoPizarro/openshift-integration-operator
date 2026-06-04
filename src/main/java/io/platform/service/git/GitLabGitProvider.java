package io.platform.service.git;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.Optional;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

@ApplicationScoped
public class GitLabGitProvider implements GitProvider {

    private static final Logger LOG = Logger.getLogger(GitLabGitProvider.class);

    @ConfigProperty(name = "gitlab.url", defaultValue = "https://gitlab.com")
    String gitlabUrl;

    @ConfigProperty(name = "git.password")
    Optional<String> gitPassword;

    @ConfigProperty(name = "gitlab.token")
    Optional<String> gitlabToken;

    private final HttpClient httpClient = buildTrustAllClient();

    private String baseUrl() {
        String url = gitlabUrl;
        if (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        return url;
    }

    private String token() {
        return gitPassword.filter(s -> !s.isBlank())
                .or(() -> gitlabToken.filter(s -> !s.isBlank()))
                .orElse("");
    }

    private String encodedProjectId(String owner, String repo) {
        return URLEncoder.encode(owner + "/" + repo, StandardCharsets.UTF_8);
    }

    @Override
    public boolean supports(String repositoryUrl) {
        if (repositoryUrl == null || repositoryUrl.isBlank()) return false;
        String lower = repositoryUrl.toLowerCase();
        return lower.contains("gitlab");
    }

    @Override
    public void ensureRepoExists(String owner, String repoName) throws Exception {
        String projectId = encodedProjectId(owner, repoName);
        String checkUrl = baseUrl() + "/api/v4/projects/" + projectId;
        HttpRequest check = HttpRequest.newBuilder()
                .uri(URI.create(checkUrl))
                .header("PRIVATE-TOKEN", token())
                .GET()
                .build();

        HttpResponse<String> resp = httpClient.send(check, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 200) {
            LOG.infof("Project %s/%s already exists on GitLab", owner, repoName);
            return;
        }

        LOG.infof("Creating project %s/%s on GitLab", owner, repoName);
        String createBody = String.format(
                "{\"name\":\"%s\",\"description\":\"IntegrationFlow scaffolded project\",\"initialize_with_readme\":true,\"namespace_id\":null}",
                repoName);

        HttpRequest create = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl() + "/api/v4/projects"))
                .header("PRIVATE-TOKEN", token())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(createBody))
                .build();

        HttpResponse<String> createResp = httpClient.send(create, HttpResponse.BodyHandlers.ofString());
        if (createResp.statusCode() != 201 && createResp.statusCode() != 200) {
            throw new RuntimeException("Failed to create GitLab project: HTTP " + createResp.statusCode() + " " + createResp.body());
        }
        LOG.infof("Project %s/%s created on GitLab", owner, repoName);
    }

    @Override
    public void createOrUpdateFile(String owner, String repo, String branch, String path, String content, String commitMessage) throws Exception {
        if (content == null || content.isBlank()) return;
        String projectId = encodedProjectId(owner, repo);
        String encodedPath = URLEncoder.encode(path, StandardCharsets.UTF_8);
        String apiUrl = baseUrl() + "/api/v4/projects/" + projectId + "/repository/files/" + encodedPath;

        HttpRequest getFile = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl + "?ref=" + branch))
                .header("PRIVATE-TOKEN", token())
                .GET()
                .build();
        HttpResponse<String> getResp = httpClient.send(getFile, HttpResponse.BodyHandlers.ofString());

        String encodedContent = Base64.getEncoder().encodeToString(content.getBytes(StandardCharsets.UTF_8));
        String escapedMessage = commitMessage.replace("\"", "\\\"");

        if (getResp.statusCode() == 200) {
            String body = String.format(
                    "{\"branch\":\"%s\",\"content\":\"%s\",\"commit_message\":\"%s\",\"encoding\":\"base64\"}",
                    branch, encodedContent, escapedMessage);
            HttpRequest update = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .header("PRIVATE-TOKEN", token())
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> updateResp = httpClient.send(update, HttpResponse.BodyHandlers.ofString());
            if (updateResp.statusCode() != 200) {
                throw new RuntimeException("GitLab update file failed: HTTP " + updateResp.statusCode());
            }
        } else {
            String body = String.format(
                    "{\"branch\":\"%s\",\"content\":\"%s\",\"commit_message\":\"%s\",\"encoding\":\"base64\"}",
                    branch, encodedContent, escapedMessage);
            HttpRequest create = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .header("PRIVATE-TOKEN", token())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> createResp = httpClient.send(create, HttpResponse.BodyHandlers.ofString());
            if (createResp.statusCode() != 201 && createResp.statusCode() != 200) {
                throw new RuntimeException("GitLab create file failed: HTTP " + createResp.statusCode());
            }
        }
        LOG.infof("File %s written to %s/%s on GitLab", path, owner, repo);
    }

    @Override
    public String getLatestCommitHash(String owner, String repo, String branch) {
        try {
            String projectId = encodedProjectId(owner, repo);
            String url = baseUrl() + "/api/v4/projects/" + projectId + "/repository/branches/" + branch;
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("PRIVATE-TOKEN", token())
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                String sha = GiteaGitProvider.extractJsonField(resp.body(), "id");
                if (sha.isEmpty()) {
                    sha = GiteaGitProvider.extractJsonField(resp.body(), "sha");
                }
                return sha.length() >= 7 ? sha.substring(0, 7) : sha;
            }
        } catch (Exception e) {
            LOG.warnf("Could not fetch latest commit hash from GitLab: %s", e.getMessage());
        }
        return "unknown";
    }

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
}
