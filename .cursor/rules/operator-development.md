---
description: Rules for developing JOSDK operator reconcilers
globs: ["**/operator/**/*.java", "**/api/**/*.java"]
---

# Operator Development Rules

## Creating a New CRD
1. Create Spec class in `io.platform.api.v1alpha1` with getters/setters
2. Create Status class with a Phase enum for lifecycle tracking
3. Create the CustomResource class extending `CustomResource<Spec, Status>`
4. Annotate with `@Group("platform.io")`, `@Version("v1alpha1")`, `@ShortNames`
5. Override `initSpec()` and `initStatus()` to provide defaults

## Reconciler Best Practices
- Wrap the entire reconcile body in try/catch, setting Error phase on failure
- Log at INFO level: reconcile start, phase transitions, external calls
- Log at ERROR level: exceptions with full stack trace
- Use `context.getSecondaryResource()` for dependent resources
- Return `UpdateControl.patchStatus()` after every status change
- Never block the reconcile thread -- use async patterns for long operations

## Fabric8 Generic Resources
For Tekton PipelineRun and ArgoCD Application, use `GenericKubernetesResource`:
```java
var resource = new GenericKubernetesResourceBuilder()
    .withApiVersion("tekton.dev/v1")
    .withKind("PipelineRun")
    .withMetadata(new ObjectMetaBuilder()...build())
    .build();
kubernetesClient.resource(resource).inNamespace(ns).create();
```
