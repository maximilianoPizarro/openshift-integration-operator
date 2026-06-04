---
name: add-integration-engine
description: Add a new integration engine type to the operator (beyond CAMEL and SONATAFLOW)
---

# Adding a New Integration Engine

## Steps

1. **Update EngineType enum** in `src/main/java/io/platform/api/v1alpha1/EngineType.java`
   - Add the new engine constant

2. **Add scaffolding logic** in `src/main/java/io/platform/service/DefaultScaffoldingService.java`
   - Add a new `else if` branch in `scaffold()` method
   - Create a `generateXxxPom()` method with the appropriate Quarkus extensions
   - The generated POM should include `quarkus-opentelemetry` for OTel support

3. **Update telemetry node lists** in `src/main/java/io/platform/telemetry/TelemetryResource.java`
   - Add node names specific to the new engine in the stream generator

4. **Update Helm chart** if the new engine requires additional RBAC permissions
   - Edit `helm/openshift-integration-operator/templates/clusterrole.yaml`

5. **Update documentation**
   - Add engine description to `docs/architecture.html`
   - Update `README.md` features list

6. **Test**
   - Create a sample IntegrationFlow CR with the new engine type
   - Verify the reconciler scaffolds correctly
