---
description: OpenShift Integration Operator project conventions
globs: ["**/*.java", "**/*.yaml", "**/*.yml", "**/*.tsx", "**/*.ts"]
---

# Project Conventions

## Tech Stack
- Java 17, Quarkus 3.36.1, Maven
- Quarkus Operator SDK (JOSDK) 7.7.5 with Fabric8 Kubernetes Client
- RESTEasy Reactive + Jackson for REST/SSE endpoints
- TypeScript/React for OpenShift Console Dynamic Plugin

## Package Structure
- `io.platform.api.v1alpha1` -- CRD model classes (IntegrationFlow, Spec, Status, EngineType)
- `io.platform.operator` -- JOSDK Reconciler implementations
- `io.platform.service` -- Business logic (ScaffoldingService, GitOpsService)
- `io.platform.telemetry` -- REST/SSE telemetry endpoints
- `io.platform.mcp` -- MCP (Model Context Protocol) bridge for AI tool calling

## JOSDK Patterns
- Reconcilers implement `Reconciler<T>` and are annotated with `@ControllerConfiguration`
- Always use `UpdateControl.patchStatus()` for status updates, never `updateResource()`
- Status transitions follow: Scaffolding -> Building -> Deploying -> Running | Error
- Use Fabric8 `KubernetesClient` for creating Tekton PipelineRun resources
- CDI injection with `@Inject`, services are `@ApplicationScoped`

## Coding Standards
- Use Java records for DTOs and immutable data classes
- Use `org.jboss.logging.Logger` for logging (not SLF4J directly)
- Use `Multi<T>` from SmallRye Mutiny for reactive/SSE streams
- No Lombok -- use records or explicit getters/setters for CRD spec/status
- Text blocks (triple quotes) for multi-line strings like generated POM XML

## Helm Chart
- Templates in `helm/openshift-integration-operator/templates/`
- Use `_helpers.tpl` for all label/name helpers
- All resources use `{{ .Values.namespace }}` for namespace

## Console Plugin (TypeScript)
- Source in `console-plugin/src/components/`
- Uses `@openshift-console/dynamic-plugin-sdk` for K8s resource hooks
- Kaoto embedded via iframe, communication via `postMessage` API
- Telemetry via `EventSource` SSE client

## Testing
- Unit tests use `@QuarkusTest` and rest-assured
- Test files mirror source structure under `src/test/java/`
