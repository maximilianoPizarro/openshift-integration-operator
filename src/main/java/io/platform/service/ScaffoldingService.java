package io.platform.service;

import io.platform.api.v1alpha1.EngineType;
import io.platform.api.v1alpha1.IntegrationType;
import io.platform.api.v1alpha1.ResilienceSpec;

public interface ScaffoldingService {

    ScaffoldResult scaffold(IntegrationType type, String kaotoDesign);

    ScaffoldResult scaffold(IntegrationType type, String kaotoDesign, ResilienceSpec resilience);

    default ScaffoldResult scaffold(EngineType engine, String kaotoDesign) {
        return scaffold(IntegrationType.fromEngineType(engine), kaotoDesign);
    }

    record ScaffoldResult(
            String pomXml,
            String workflowDefinition,
            String projectStructureSummary,
            String kaotoConfig,
            String otelDecoratorJava,
            String kustomizeBase,
            String applicationProperties
    ) {
        public ScaffoldResult(String pomXml, String workflowDefinition, String projectStructureSummary) {
            this(pomXml, workflowDefinition, projectStructureSummary, "", "", "", "");
        }
    }
}
