# Releasing OpenShift Integration Operator

This document outlines the standard release process for the OpenShift Integration Operator to ensure consistency across versions.

## Release Process

1. **Verify CI/CD Status**: Ensure all tests and GitHub Actions pass on the `main` branch.
2. **Update Version**: Update the version across all manifests, charts, and documentation. 
   > **CRITICAL RULE**: The version badge in `README.md`, the installation command in the documentation, and the Quay image tags **must all be updated in the same commit** to prevent version drift.
3. **Generate Artifacts**: Build the OLM bundle, console-plugin, and operator images using the CI or local scripts.
4. **Create Tag**: Create a git tag for the new release version (e.g., `v1.2.3`).
5. **Publish Images**: Push the newly built container images to Quay.io.
6. **Publish Helm Chart**: Publish the updated Helm chart to the repository (GitHub Pages).
7. **Create GitHub Release**: Create a new GitHub release detailing the changelog and linking to the new artifacts.
8. **OperatorHub Submission**: Open a PR to `k8s-operatorhub/community-operators` with the new bundle.
