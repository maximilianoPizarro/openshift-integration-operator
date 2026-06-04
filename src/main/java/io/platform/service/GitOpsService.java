package io.platform.service;

public interface GitOpsService {

    GitPushResult pushScaffold(String gitRepository, String branch, ScaffoldingService.ScaffoldResult scaffoldResult);

    record GitPushResult(String commitHash, boolean success, String message) {}
}
