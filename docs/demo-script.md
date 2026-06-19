# 3-Minute Platform Demo Script

Use this script when recording a walkthrough for the landing page video placeholder.

## 0:00 — Context

- Operator already installed via Quay `v0.8.1` OLM bundle (or Helm equivalent)
- Open **Integration Platform → Overview** in the OpenShift Console
- Mention: lifecycle layer for Apache Camel — not an iPaaS

## 0:30 — Ephemeral Quick Try

- **Integration Flows → Create Flow** (or apply `k8s/examples/09-ephemeral-demo.yaml`)
- Show `deploymentMode: EPHEMERAL` and `kaotoDesign` timer route
- Wait for **phase: Running**
- Open flow detail → **Logs** tab, follow worker output

## 1:15 — Console plugin depth

- Show visual diagram (saga or simple route)
- Open **Platform Status** — Operator, console plugin version on Overview
- Optional: **Browse Templates** from create form (catalog)

## 1:45 — Promote to GitOps (optional)

- Click **Promote to GitOps** on ephemeral flow (if Gitea configured)
- Or show GitOps example `01-rest-to-kafka` reaching Running via Tekton + Argo CD

## 2:30 — Multicluster (screenshot)

- Show `spec.targeting.clusters` on example `10-multicluster-demo.yaml`
- Argo CD ApplicationSet in `openshift-gitops`

## 2:50 — CTA

- **Contribute a flow** — `docs/contributing.html`, `scripts/prepare-flow-contribution.sh`
- Link quickstart Track A for evaluators
