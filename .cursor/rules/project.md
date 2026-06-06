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
- `io.platform.api.v1alpha1` -- CRD model classes (IntegrationFlow, Spec, Status, EngineType, DeploymentMode, EphemeralSpec)
- `io.platform.operator` -- JOSDK Reconciler implementations
- `io.platform.ephemeral` -- Ephemeral runtime deployers and cleanup (Quick Try mode)
- `io.platform.lifecycle` -- Flow lifecycle REST API (pause/resume/stop, extend TTL, promote, logs)
- `io.platform.service` -- Business logic (ScaffoldingService, GitOpsService, GitOpsManifestGenerator)
- `io.platform.service.git` -- GitProvider implementations and GitUrlResolver (placeholder host rewrite)
- `io.platform.telemetry` -- REST/SSE telemetry endpoints
- `io.platform.mcp` -- MCP (Model Context Protocol) bridge for AI tool calling

## JOSDK Patterns
- Reconcilers implement `Reconciler<T>` and are annotated with `@ControllerConfiguration`
- Always use `UpdateControl.patchStatus()` for status updates, never `updateResource()`
- Status transitions follow: Scaffolding -> Building -> Deploying -> Running | Paused | Stopped | Expired | Error
- Ephemeral flows (`deploymentMode: EPHEMERAL`) skip GitOps; `Expired` phase set when TTL elapses
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

## GitOps scaffold
- `DefaultScaffoldingService` generates `pom.xml` (Java 17, Quarkus plugin), runtime Dockerfile, and workflow files
- `DefaultGitOpsService` pushes scaffold + `base/` manifests (deployment/service, pipe, kamelet, or sonataflow)
- Tekton pipeline builds with `build-maven` then image stage copies `target/quarkus-app`
- Examples: `k8s/examples/01`–`08` (GitOps), `09`+ (ephemeral); bootstrap: `k8s/bootstrap/camel-k-platform.yaml`

## Skills (`.cursor/skills/`)
- `deploy-to-openshift` -- operator Helm deploy, digest pinning, Camel K bootstrap
- `gitops-examples` -- eight catalog flows, Tekton + Argo CD verification
- `console-plugin-build` -- Quay CI image for cluster; local webpack for dev
- `ephemeral-mode` -- Quick Try TTL, worker tiers, promote-to-gitops

## Testing
- Unit tests use `@QuarkusTest` and rest-assured
- Test files mirror source structure under `src/test/java/`
- `GitOpsManifestGeneratorTest`, `ScaffoldingServiceTest` cover scaffold output
