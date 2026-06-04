package io.platform.service.git;

public interface GitProvider {
    boolean supports(String repositoryUrl);
    void ensureRepoExists(String owner, String repoName) throws Exception;
    void createOrUpdateFile(String owner, String repo, String branch, String path, String content, String commitMessage) throws Exception;
    String getLatestCommitHash(String owner, String repo, String branch);
}
