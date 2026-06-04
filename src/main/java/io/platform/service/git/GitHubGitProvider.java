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
public class GitHubGitProvider implements GitProvider {

    private static final Logger LOG = Logger.getLogger(GitHubGitProvider.class);

    @ConfigProperty(name = "GITHUB_URL", defaultValue = "https://api.github.com")
    String githubUrl;

    @ConfigProperty(name = "GIT_PASSWORD")
    Optional<String> gitPassword;

    @ConfigProperty(name = "GITHUB_TOKEN", defaultValue = "")
    String githubToken;

    private final HttpClient httpClient = buildTrustAllClient();

    private String baseUrl() {
        String url = githubUrl;
        if (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        if (!url.contains("/api/")) {
            if (!url.equals("https://api.github.com")) {
                url = url + "/api/v3";
            }
        }
        return url;
    }

    private String token() {
        return gitPassword.filter(s -> !s.isBlank()).orElse(githubToken);
    }

    private String authHeader() {
        return "token " + token();
    }

    @Override
    public boolean supports(String repositoryUrl) {
        if (repositoryUrl == null || repositoryUrl.isBlank()) return false;
        String lower = repositoryUrl.toLowerCase();
        return lower.contains("github.com") || lower.contains("github");
    }

    @Override
    public void ensureRepoExists(String owner, String repoName) throws Exception {
        String checkUrl = baseUrl() + "/repos/" + owner + "/" + repoName;
        HttpRequest check = HttpRequest.newBuilder()
                .uri(URI.create(checkUrl))
                .header("Authorization", authHeader())
                .header("Accept", "application/vnd.github+json")
                .GET()
                .build();

        HttpResponse<String> resp = httpClient.send(check, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 200) {
            LOG.infof("Repo %s/%s already exists on GitHub", owner, repoName);
            return;
        }

        LOG.infof("Creating repo %s/%s on GitHub", owner, repoName);
        String createBody = String.format(
                "{\"name\":\"%s\",\"description\":\"IntegrationFlow scaffolded project\",\"auto_init\":true}",
                repoName);

        HttpRequest create = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl() + "/user/repos"))
                .header("Authorization", authHeader())
                .header("Accept", "application/vnd.github+json")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(createBody))
                .build();

        HttpResponse<String> createResp = httpClient.send(create, HttpResponse.BodyHandlers.ofString());
        if (createResp.statusCode() != 201 && createResp.statusCode() != 200) {
            throw new RuntimeException("Failed to create GitHub repo: HTTP " + createResp.statusCode() + " " + createResp.body());
        }
        LOG.infof("Repo %s/%s created on GitHub", owner, repoName);
    }

    @Override
    public void createOrUpdateFile(String owner, String repo, String branch, String path, String content, String commitMessage) throws Exception {
        if (content == null || content.isBlank()) return;
        String encodedContent = Base64.getEncoder().encodeToString(content.getBytes(StandardCharsets.UTF_8));
        String apiPath = baseUrl() + "/repos/" + owner + "/" + repo + "/contents/" + path;

        HttpRequest getFile = HttpRequest.newBuilder()
                .uri(URI.create(apiPath + "?ref=" + branch))
                .header("Authorization", authHeader())
                .header("Accept", "application/vnd.github+json")
                .GET()
                .build();
        HttpResponse<String> getResp = httpClient.send(getFile, HttpResponse.BodyHandlers.ofString());

        String body;
        if (getResp.statusCode() == 200) {
            String sha = GiteaGitProvider.extractJsonField(getResp.body(), "sha");
            body = String.format("{\"message\":\"%s\",\"content\":\"%s\",\"branch\":\"%s\",\"sha\":\"%s\"}",
                    commitMessage, encodedContent, branch, sha);
        } else {
            body = String.format("{\"message\":\"%s\",\"content\":\"%s\",\"branch\":\"%s\"}",
                    commitMessage, encodedContent, branch);
        }

        HttpRequest put = HttpRequest.newBuilder()
                .uri(URI.create(apiPath))
                .header("Authorization", authHeader())
                .header("Accept", "application/vnd.github+json")
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> putResp = httpClient.send(put, HttpResponse.BodyHandlers.ofString());
        if (putResp.statusCode() != 200 && putResp.statusCode() != 201) {
            throw new RuntimeException("GitHub create/update file failed: HTTP " + putResp.statusCode());
        }
        LOG.infof("File %s written to %s/%s on GitHub", path, owner, repo);
    }

    @Override
    public String getLatestCommitHash(String owner, String repo, String branch) {
        try {
            String url = baseUrl() + "/repos/" + owner + "/" + repo + "/git/ref/heads/" + branch;
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", authHeader())
                    .header("Accept", "application/vnd.github+json")
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                String sha = GiteaGitProvider.extractJsonField(resp.body(), "sha");
                return sha.length() >= 7 ? sha.substring(0, 7) : sha;
            }
        } catch (Exception e) {
            LOG.warnf("Could not fetch latest commit hash from GitHub: %s", e.getMessage());
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
