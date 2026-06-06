package io.platform.service.git;

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
import java.util.Optional;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

@ApplicationScoped
public class GiteaGitProvider implements GitProvider {

    private static final Logger LOG = Logger.getLogger(GiteaGitProvider.class);

    @ConfigProperty(name = "git.url")
    Optional<String> gitUrl;

    @ConfigProperty(name = "gitea.url", defaultValue = "https://gitea-gitea.apps.cluster.local")
    String giteaUrl;

    @ConfigProperty(name = "git.username")
    Optional<String> gitUsername;

    @ConfigProperty(name = "gitea.username", defaultValue = "user1")
    String giteaUsername;

    @ConfigProperty(name = "git.password")
    Optional<String> gitPassword;

    @ConfigProperty(name = "gitea.password", defaultValue = "")
    String giteaPassword;

    @ConfigProperty(name = "git.org")
    Optional<String> gitOrg;

    @ConfigProperty(name = "gitea.org", defaultValue = "user1")
    String giteaOrg;

    private final HttpClient httpClient = buildTrustAllClient();

    private String baseUrl() {
        return gitUrl.filter(s -> !s.isBlank()).orElse(giteaUrl);
    }

    private String username() {
        return gitUsername.filter(s -> !s.isBlank()).orElse(giteaUsername);
    }

    private String password() {
        return gitPassword.filter(s -> !s.isBlank()).orElse(giteaPassword);
    }

    private String org() {
        return gitOrg.filter(s -> !s.isBlank()).orElse(giteaOrg);
    }

    private String authHeader() {
        String credentials = username() + ":" + password();
        return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public boolean supports(String repositoryUrl) {
        if (repositoryUrl == null || repositoryUrl.isBlank()) return true;
        String lower = repositoryUrl.toLowerCase();
        return lower.contains("gitea") ||
               (!lower.contains("github.com") && !lower.contains("github") &&
                !lower.contains("gitlab.com") && !lower.contains("gitlab"));
    }

    @Override
    public void ensureRepoExists(String owner, String repoName) throws Exception {
        String effectiveOwner = (owner == null || owner.isBlank()) ? org() : owner;
        String checkUrl = baseUrl() + "/api/v1/repos/" + effectiveOwner + "/" + repoName;
        HttpRequest check = HttpRequest.newBuilder()
                .uri(URI.create(checkUrl))
                .header("Authorization", authHeader())
                .GET()
                .build();

        HttpResponse<String> resp = httpClient.send(check, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 200) {
            LOG.infof("Repo %s/%s already exists on Gitea", effectiveOwner, repoName);
            return;
        }
        if (resp.statusCode() == 401 || resp.statusCode() == 403) {
            throw new RuntimeException("Gitea authentication failed (HTTP " + resp.statusCode()
                    + ") — verify gitea.username and gitea.password");
        }

        LOG.infof("Creating repo %s/%s on Gitea", effectiveOwner, repoName);
        String createBody = String.format(
                "{\"name\":\"%s\",\"description\":\"IntegrationFlow scaffolded project\",\"auto_init\":true,\"default_branch\":\"main\"}",
                repoName);

        HttpRequest create = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl() + "/api/v1/user/repos"))
                .header("Authorization", authHeader())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(createBody))
                .build();

        HttpResponse<String> createResp = httpClient.send(create, HttpResponse.BodyHandlers.ofString());
        if (createResp.statusCode() == 409) {
            LOG.infof("Repo %s/%s already exists on Gitea (409)", effectiveOwner, repoName);
            return;
        }
        if (createResp.statusCode() != 201 && createResp.statusCode() != 200) {
            throw new RuntimeException("Failed to create Gitea repo: HTTP " + createResp.statusCode() + " " + createResp.body());
        }
        LOG.infof("Repo %s/%s created on Gitea", effectiveOwner, repoName);
    }

    @Override
    public void createOrUpdateFile(String owner, String repo, String branch, String path, String content, String commitMessage) throws Exception {
        if (content == null || content.isBlank()) return;
        String effectiveOwner = (owner == null || owner.isBlank()) ? org() : owner;
        String encodedContent = Base64.getEncoder().encodeToString(content.getBytes(StandardCharsets.UTF_8));
        String apiPath = baseUrl() + "/api/v1/repos/" + effectiveOwner + "/" + repo + "/contents/" + path;

        RuntimeException lastError = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                writeFile(apiPath, branch, encodedContent, commitMessage);
                LOG.infof("File %s written to %s/%s on Gitea", path, effectiveOwner, repo);
                return;
            } catch (RuntimeException e) {
                lastError = e;
                if (attempt < 3 && isRetryableGiteaError(e)) {
                    LOG.warnf("Retrying Gitea write for %s (attempt %d): %s", path, attempt, e.getMessage());
                    Thread.sleep(attempt * 1500L);
                }
            }
        }
        throw lastError != null ? lastError : new RuntimeException("Gitea write failed for " + path);
    }

    private void writeFile(String apiPath, String branch, String encodedContent, String commitMessage) throws Exception {
        HttpRequest getFile = HttpRequest.newBuilder()
                .uri(URI.create(apiPath + "?ref=" + branch))
                .header("Authorization", authHeader())
                .GET()
                .build();
        HttpResponse<String> getResp = httpClient.send(getFile, HttpResponse.BodyHandlers.ofString());

        if (getResp.statusCode() == 200) {
            String sha = extractJsonField(getResp.body(), "sha");
            String body = String.format("{\"content\":\"%s\",\"message\":\"%s\",\"branch\":\"%s\",\"sha\":\"%s\"}",
                    encodedContent, commitMessage, branch, sha);
            HttpRequest update = HttpRequest.newBuilder()
                    .uri(URI.create(apiPath))
                    .header("Authorization", authHeader())
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> updateResp = httpClient.send(update, HttpResponse.BodyHandlers.ofString());
            if (updateResp.statusCode() != 200) {
                throw new RuntimeException("Gitea update file failed: HTTP " + updateResp.statusCode());
            }
        } else if (getResp.statusCode() == 404) {
            String body = String.format("{\"content\":\"%s\",\"message\":\"%s\",\"branch\":\"%s\"}",
                    encodedContent, commitMessage, branch);
            HttpRequest create = HttpRequest.newBuilder()
                    .uri(URI.create(apiPath))
                    .header("Authorization", authHeader())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> createResp = httpClient.send(create, HttpResponse.BodyHandlers.ofString());
            if (createResp.statusCode() != 201 && createResp.statusCode() != 200) {
                throw new RuntimeException("Gitea create file failed: HTTP " + createResp.statusCode());
            }
        } else {
            throw new RuntimeException("Gitea read file failed: HTTP " + getResp.statusCode());
        }
    }

    private static boolean isRetryableGiteaError(RuntimeException e) {
        String msg = e.getMessage();
        return msg != null && (msg.contains("HTTP 500") || msg.contains("HTTP 409") || msg.contains("HTTP 503"));
    }

    @Override
    public String getLatestCommitHash(String owner, String repo, String branch) {
        try {
            String effectiveOwner = (owner == null || owner.isBlank()) ? org() : owner;
            String url = baseUrl() + "/api/v1/repos/" + effectiveOwner + "/" + repo + "/git/refs/heads/" + branch;
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", authHeader())
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                String sha = extractJsonField(resp.body(), "sha");
                return sha.length() >= 7 ? sha.substring(0, 7) : sha;
            }
        } catch (Exception e) {
            LOG.warnf("Could not fetch latest commit hash from Gitea: %s", e.getMessage());
        }
        return "unknown";
    }

    static String extractJsonField(String json, String field) {
        String searchKey = "\"" + field + "\":\"";
        int start = json.indexOf(searchKey);
        if (start < 0) return "";
        start += searchKey.length();
        int end = json.indexOf("\"", start);
        return end > start ? json.substring(start, end) : "";
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
