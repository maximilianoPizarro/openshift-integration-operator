# PatternFly Compliance Audit

Audit date: 2026-06-05. Target: OpenShift Console dynamic plugin (`console-plugin/`).

## Version matrix

| OpenShift | PatternFly | Notes |
|-----------|------------|-------|
| 4.14 | 4.x | Baseline SDK components |
| 4.15–4.18 | 5.x | Primary target for this plugin |
| 4.19+ | 6.x | Verify visual regressions when upgrading cluster |

## Compliance checklist

| Rule | Status | Evidence |
|------|--------|----------|
| Use `@patternfly/react-core` / `@patternfly/react-table` / `@patternfly/react-icons` | Pass | All UI components import from PatternFly packages |
| No Bootstrap / Tailwind / Material UI | Pass | `grep` shows no third-party CSS frameworks |
| CSS prefixed with `integration-plugin__` | Pass | Scoped styles in component CSS modules / BEM |
| OpenShift Console SDK for navigation & extensions | Pass | `console-extensions.json`, SDK hooks |
| Accessible modals and alerts | Pass | `Modal`, `Alert`, `Button` variants from PF |
| Tables use PF Table, not raw HTML tables | Pass | `IntegrationFlowPage`, `PlatformStatusPage` |
| Forms use PF Form components | Pass | `FlowDesignerPage`, ephemeral modals |

## Components reviewed

- `IntegrationFlowPage.tsx` — PF Table, Toolbar, SearchInput
- `FlowDesignerPage.tsx` — PF Card, Tabs, Form
- `FlowOverviewPage.tsx` — PF Grid, Card, Chart wrappers
- `PlatformStatusPage.tsx` — PF Table, Badge, Spinner
- `FlowLogsTab.tsx` — PF CodeBlock, Toolbar
- `ephemeral/*` — PF Alert, Label, Switch, Modal

## Recommendations

1. Re-run visual smoke test on OCP 4.19+ when PF6 becomes default.
2. Keep `@patternfly/react-core` version aligned with OpenShift Console SDK peer deps.
3. Avoid inline styles except for Kaoto canvas overlays (telemetry nodes).
