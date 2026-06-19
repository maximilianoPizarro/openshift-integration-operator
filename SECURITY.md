# Security Policy

## Supported Versions

Currently, the following versions of the OpenShift Integration Operator are supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| v0.x    | :white_check_mark: |

## Published vulnerability reports (Artifact Hub)

Container images for the Helm chart (operator, console plugin, and Camel worker tiers) are scanned on [Artifact Hub](https://artifacthub.io/packages/helm/openshift-integration-operator/openshift-integration-operator) using [Trivy](https://github.com/aquasecurity/trivy). Reports are refreshed daily from the image list declared in `helm/openshift-integration-operator/Chart.yaml` (`artifacthub.io/images`).

- **Artifact Hub security tab**: [Trivy scan report](https://artifacthub.io/packages/helm/openshift-integration-operator/openshift-integration-operator?tab=security-report)
- **Helm package page**: [openshift-integration-operator on Artifact Hub](https://artifacthub.io/packages/helm/openshift-integration-operator/openshift-integration-operator)
- **Per-image dashboard (GitHub Pages)**: [security.html](https://maximilianopizarro.github.io/openshift-integration-operator/security.html)

New chart versions may take up to about one hour to appear in Artifact Hub after a Helm release is published.

## Reporting a Vulnerability

We take the security of this project very seriously. If you discover a vulnerability, please **do not** open a public issue.

Instead, please report it privately using one of these channels:

1. **GitHub Private Vulnerability Reporting** (preferred): [Report a vulnerability](https://github.com/maximilianoPizarro/openshift-integration-operator/security/advisories/new) on the repository Security tab.
2. **Email the Maintainers**: Send a detailed report to the project maintainers if you cannot use GitHub. Include steps to reproduce the issue.

3. **Evaluation**: We will acknowledge receipt of your vulnerability report within 48 hours and begin investigation.
4. **Resolution**: If confirmed, we will draft a patch, test it, and release an update. We will publicly announce the vulnerability only after a patch is available and users have been given reasonable time to upgrade.
5. **Credit**: We will credit you for the discovery when the advisory is published, unless you prefer to remain anonymous.
