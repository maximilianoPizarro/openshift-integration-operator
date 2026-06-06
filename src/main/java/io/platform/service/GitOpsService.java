package io.platform.service;

import io.platform.api.v1alpha1.IntegrationType;

public interface GitOpsService {

    GitPushResult pushScaffold(String gitRepository, String branch, String integrationFlowName,
                               IntegrationType integrationType, ScaffoldingService.ScaffoldResult scaffoldResult);

    record GitPushResult(String commitHash, boolean success, String message) {}
}