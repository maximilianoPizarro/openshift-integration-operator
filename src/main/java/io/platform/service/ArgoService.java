package io.platform.service;

import io.platform.api.v1alpha1.IntegrationFlowStatus;

import java.util.List;
import java.util.Map;

public interface ArgoService {
    void reconcileApplicationSet(String name, String namespace, String gitRepoUrl,
                                  String branch, String path,
                                  Map<String, String> clusterSelector,
                                  List<String> excludeClusters);

    List<IntegrationFlowStatus.ClusterDeployment> getClusterDeployments(String applicationSetName);

    void deleteApplicationSet(String name, String namespace);
}
