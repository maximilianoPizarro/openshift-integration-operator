package io.platform.service;

import io.platform.api.v1alpha1.EngineType;

public interface ScaffoldingService {

    ScaffoldResult scaffold(EngineType engine, String kaotoDesign);

    record ScaffoldResult(String pomXml, String workflowDefinition, String projectStructureSummary) {}
}
