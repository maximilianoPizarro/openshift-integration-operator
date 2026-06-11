import '../theme/tokens.css';
import * as React from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Label,
  PageSection,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { ExternalLinkAltIcon, ArrowRightIcon } from '@patternfly/react-icons';
import { DOCS_BASE_URL, GITHUB_REPO_URL, NAMESPACE } from '../constants';

const API_BASE = '/api/kubernetes/apis/platform.io/v1alpha1';
const K8S_TEKTON = '/api/kubernetes/apis/tekton.dev/v1';

interface IntegrationFlow {
  metadata: { name: string; namespace: string; creationTimestamp: string; uid: string };
  spec: { engine: string; integrationType?: string; gitRepository: string; branch: string };
  status?: { phase: string; message?: string; gitCommitHash?: string; argoApplicationName?: string; applicationSetName?: string };
}

interface PipelineRun {
  metadata: { name: string; creationTimestamp: string; labels?: Record<string, string> };
  status?: { conditions?: Array<{ type: string; status: string; reason?: string }>; completionTime?: string; startTime?: string };
}

type LabelColor = 'blue' | 'teal' | 'green' | 'orange' | 'purple' | 'red' | 'grey' | 'yellow';

const TYPES = [
  { value: 'CAMEL_ROUTE', label: 'Camel Route', color: '#f0ab00', labelColor: 'yellow' as LabelColor },
  { value: 'CAMEL_KAMELET', label: 'Kamelet', color: '#8476d1', labelColor: 'purple' as LabelColor },
  { value: 'CAMEL_PIPE', label: 'Pipe', color: '#2b9af3', labelColor: 'blue' as LabelColor },
  { value: 'CAMEL_TEST', label: 'Test', color: '#3e8635', labelColor: 'green' as LabelColor },
  { value: 'SONATAFLOW', label: 'SonataFlow', color: '#009596', labelColor: 'teal' as LabelColor },
];

const PHASES = [
  { value: 'Running', color: '#3e8635', labelColor: 'green' as LabelColor },
  { value: 'Building', color: '#f0ab00', labelColor: 'yellow' as LabelColor },
  { value: 'Deploying', color: '#0066cc', labelColor: 'blue' as LabelColor },
  { value: 'Scaffolding', color: '#8476d1', labelColor: 'purple' as LabelColor },
  { value: 'Paused', color: '#f0ab00', labelColor: 'orange' as LabelColor },
  { value: 'Error', color: '#c9190b', labelColor: 'red' as LabelColor },
  { value: 'Stopped', color: '#6a6e73', labelColor: 'grey' as LabelColor },
];

const ONBOARDING_STEPS = [
  {
    step: 1,
    title: 'Pick a starting point',
    description: 'Create a blank flow or browse 200+ ready-made templates (Saga, Circuit Breaker, Hybrid Cloud SaaS, public APIs, AI/LLM). Templates are editable starting points — customize before deploying.',
    action: { label: 'Create Flow', href: '/integration-flows', internal: true },
  },
  {
    step: 2,
    title: 'Design your integration',
    description: 'Edit the route in the visual Kaoto designer or YAML editor. Camel routes, Kamelets, Pipes, tests, and SonataFlow workflows are all supported.',
    action: { label: 'Open Kaoto docs', href: 'https://kaoto.io/workshop/', internal: false },
  },
  {
    step: 3,
    title: 'Deploy and iterate',
    description: 'Use Quick Try (ephemeral) for zero-config testing with TTL, or GitOps mode for Tekton builds and Argo CD promotion across clusters.',
    action: { label: 'Quick Start guide', href: `${DOCS_BASE_URL}/quickstart.html`, internal: false },
  },
];

const PLATFORM_DOCS = [
  { label: 'Documentation Home', href: DOCS_BASE_URL, description: 'Platform overview, features, and screenshots' },
  { label: 'Quick Start', href: `${DOCS_BASE_URL}/quickstart.html`, description: 'Install, first flow, ephemeral & GitOps modes' },
  { label: 'Ready Flows (200+)', href: `${DOCS_BASE_URL}/ready-flows.html`, description: 'Copy-paste IntegrationFlow CRs by pattern' },
  { label: 'Examples Catalog (255)', href: `${DOCS_BASE_URL}/examples-catalog.html`, description: '310 Camel Quarkus components with snippets' },
  { label: 'Architecture', href: `${DOCS_BASE_URL}/architecture.html`, description: 'CRD spec, reconciliation, multi-cluster' },
  { label: 'Operations', href: `${DOCS_BASE_URL}/operations.html`, description: 'RBAC, secrets, troubleshooting, upgrades' },
  { label: 'GitHub Repository', href: GITHUB_REPO_URL, description: 'Source code, issues, and CI/CD workflows' },
];

const TECH_REFERENCES = [
  { label: 'Apache Camel', href: 'https://camel.apache.org/manual/', description: 'Enterprise integration patterns and core concepts' },
  { label: 'Camel Components', href: 'https://camel.apache.org/components/latest/', description: 'Reference for 300+ connectors and endpoints' },
  { label: 'Camel Quarkus', href: 'https://camel.apache.org/camel-quarkus/latest/', description: 'Cloud-native Camel runtime used by workers' },
  { label: 'Camel K', href: 'https://camel.apache.org/camel-k/', description: 'Kamelets, Pipes, and Kubernetes-native Camel' },
  { label: 'SonataFlow', href: 'https://sonataflow.org/', description: 'Serverless workflow engine (CNCF Serverless Workflow)' },
  { label: 'Kogito', href: 'https://kogito.kie.org/', description: 'Cloud-native business automation platform' },
  { label: 'Kaoto Designer', href: 'https://kaoto.io/', description: 'Visual editor for Camel routes and Kamelets' },
  { label: 'Enterprise Integration Patterns', href: 'https://www.enterpriseintegrationpatterns.com/', description: 'Saga, CBR, Circuit Breaker, and more' },
  { label: 'Argo CD', href: 'https://argo-cd.readthedocs.io/', description: 'GitOps continuous delivery for Kubernetes' },
  { label: 'Tekton Pipelines', href: 'https://tekton.dev/docs/', description: 'Cloud-native CI/CD pipeline framework' },
];

function timeAgo(ts: string): string {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function DocLink({ label, href, description }: { label: string; href: string; description: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        padding: '8px 10px',
        borderRadius: '6px',
        textDecoration: 'none',
        border: '1px solid var(--integration-border)',
        background: 'var(--integration-bg-surface)',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--integration-link)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--integration-border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--integration-link)' }}>
        {label}
        <ExternalLinkAltIcon style={{ fontSize: '11px' }} />
      </div>
      <div style={{ fontSize: '11px', color: 'var(--integration-text-subtle)', marginTop: '2px', lineHeight: 1.4 }}>
        {description}
      </div>
    </a>
  );
}

const FlowOverviewPage: React.FC = () => {
  const [flows, setFlows] = React.useState<IntegrationFlow[]>([]);
  const [pipelineRuns, setPipelineRuns] = React.useState<PipelineRun[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchAll = React.useCallback(async () => {
    try {
      const [flowResp, prResp] = await Promise.all([
        fetch(`${API_BASE}/namespaces/${NAMESPACE}/integrationflows`),
        fetch(`${K8S_TEKTON}/namespaces/${NAMESPACE}/pipelineruns?labelSelector=platform.io%2Fcomponent%3Dbuild&limit=50`),
      ]);
      if (flowResp.ok) { const data = await flowResp.json(); setFlows(data.items || []); }
      if (prResp.ok) { const data = await prResp.json(); setPipelineRuns(data.items || []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    flows.forEach(f => {
      const t = f.spec.integrationType || (f.spec.engine === 'CAMEL' ? 'CAMEL_ROUTE' : 'SONATAFLOW');
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [flows]);

  const phaseCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    flows.forEach(f => {
      const p = f.status?.phase || 'Pending';
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [flows]);

  const recentPRs = React.useMemo(() => {
    return [...pipelineRuns]
      .sort((a, b) => new Date(b.metadata.creationTimestamp).getTime() - new Date(a.metadata.creationTimestamp).getTime())
      .slice(0, 10);
  }, [pipelineRuns]);

  const recentFlows = React.useMemo(() => {
    return [...flows]
      .sort((a, b) => new Date(b.metadata.creationTimestamp).getTime() - new Date(a.metadata.creationTimestamp).getTime())
      .slice(0, 5);
  }, [flows]);

  const errorFlows = flows.filter(f => f.status?.phase === 'Error');
  const runningFlows = flows.filter(f => f.status?.phase === 'Running');

  if (loading) return (
    <PageSection style={{ padding: '24px' }}>
      <Spinner size="lg" aria-label="Loading overview" />
    </PageSection>
  );

  return (
    <PageSection>
      <div style={{ marginBottom: '20px' }}>
        <Title headingLevel="h1" size="xl">Flow Overview</Title>
        <span style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>
          Dashboard for {flows.length} integration flows in {NAMESPACE}
        </span>
      </div>

      {flows.length === 0 && (
        <Alert
          variant="info"
          isInline
          title="Welcome to the Integration Platform"
          style={{ marginBottom: '16px' }}
        >
          No flows yet. Follow the getting started steps below to create your first integration,
          or browse the <a href={`${DOCS_BASE_URL}/ready-flows.html`} target="_blank" rel="noopener noreferrer">Ready Flows catalog</a> for inspiration.
        </Alert>
      )}

      {/* Getting Started */}
      <Card isCompact style={{ marginBottom: '24px', borderLeft: '3px solid #2b9af3' }}>
        <CardTitle>Getting Started</CardTitle>
        <CardBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {ONBOARDING_STEPS.map(s => (
              <div
                key={s.step}
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--integration-border)',
                  background: 'var(--integration-bg-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'var(--integration-link)', color: 'var(--pf-t--global--text--color--on-brand--default, #fff)', fontSize: '12px', fontWeight: 700,
                  }}>
                    {s.step}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--integration-text-primary)' }}>{s.title}</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--integration-text-subtle)', lineHeight: 1.5, marginBottom: '10px' }}>
                  {s.description}
                </p>
                {s.action.internal ? (
                  <Button variant="link" isInline component="a" href={s.action.href} icon={<ArrowRightIcon />}>
                    {s.action.label}
                  </Button>
                ) : (
                  <Button variant="link" isInline component="a" href={s.action.href} target="_blank" rel="noopener noreferrer" icon={<ExternalLinkAltIcon />}>
                    {s.action.label}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button variant="primary" component="a" href="/integration-flows">
              + Create your first flow
            </Button>
            <Button variant="secondary" component="a" href={`${DOCS_BASE_URL}/ready-flows.html`} target="_blank" rel="noopener noreferrer" icon={<ExternalLinkAltIcon />}>
              Browse Ready Flows
            </Button>
            <Button variant="secondary" component="a" href={`${DOCS_BASE_URL}/quickstart.html`} target="_blank" rel="noopener noreferrer" icon={<ExternalLinkAltIcon />}>
              Quick Start guide
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <a href="/integration-flows" style={{ textDecoration: 'none' }}>
          <Card isCompact isFullHeight style={{ borderLeft: '3px solid #2b9af3' }}>
            <CardBody>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#2b9af3' }}>{flows.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>Total Flows</div>
            </CardBody>
          </Card>
        </a>
        <Card isCompact style={{ borderLeft: '3px solid #3e8635' }}>
          <CardBody>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#3e8635' }}>{runningFlows.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>Running</div>
          </CardBody>
        </Card>
        <Card isCompact style={{ borderLeft: `3px solid ${errorFlows.length > 0 ? '#c9190b' : '#3e8635'}` }}>
          <CardBody>
            <div style={{ fontSize: '32px', fontWeight: 700, color: errorFlows.length > 0 ? '#c9190b' : '#3e8635' }}>{errorFlows.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>Errors</div>
          </CardBody>
        </Card>
        <Card isCompact style={{ borderLeft: '3px solid #f0ab00' }}>
          <CardBody>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#f0ab00' }}>{pipelineRuns.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>Builds</div>
          </CardBody>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* By Type */}
        <Card isCompact>
          <CardTitle>Flows by Type</CardTitle>
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {TYPES.map(t => {
                const count = typeCounts[t.value] || 0;
                const pct = flows.length > 0 ? (count / flows.length) * 100 : 0;
                return (
                  <div key={t.value}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <Label color={t.labelColor} isCompact>{t.label}</Label>
                      <span style={{ color: 'var(--integration-text-subtle)' }}>{count}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--integration-border)' }}>
                      <div style={{ height: '100%', borderRadius: '3px', backgroundColor: t.color, width: `${pct}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* By Phase */}
        <Card isCompact>
          <CardTitle>Flows by Phase</CardTitle>
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PHASES.map(p => {
                const count = phaseCounts[p.value] || 0;
                const pct = flows.length > 0 ? (count / flows.length) * 100 : 0;
                return (
                  <div key={p.value}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <Label color={p.labelColor} isCompact>{p.value}</Label>
                      <span style={{ color: 'var(--integration-text-subtle)' }}>{count}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--integration-border)' }}>
                      <div style={{ height: '100%', borderRadius: '3px', backgroundColor: p.color, width: `${pct}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Documentation & References */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <Card isCompact>
          <CardTitle>Platform Documentation</CardTitle>
          <CardBody>
            <p style={{ fontSize: '12px', color: 'var(--integration-text-subtle)', marginBottom: '12px', lineHeight: 1.5 }}>
              Guides, examples, and architecture docs for this operator — hosted on GitHub Pages.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PLATFORM_DOCS.map(d => (
                <DocLink key={d.href} label={d.label} href={d.href} description={d.description} />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card isCompact>
          <CardTitle>Technology References</CardTitle>
          <CardBody>
            <p style={{ fontSize: '12px', color: 'var(--integration-text-subtle)', marginBottom: '12px', lineHeight: 1.5 }}>
              Official docs for the engines, patterns, and tools that power your integrations.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {TECH_REFERENCES.map(d => (
                <DocLink key={d.href} label={d.label} href={d.href} description={d.description} />
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Error Flows */}
      {errorFlows.length > 0 && (
        <Card isCompact style={{ borderLeft: '3px solid #c9190b', marginBottom: '20px' }}>
          <CardTitle style={{ color: '#c9190b' }}>
            {'\u26A0'} Flows with Errors ({errorFlows.length})
          </CardTitle>
          <CardBody>
            {errorFlows.map(f => (
              <div key={f.metadata.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--integration-border)' }}>
                <a href={`/integration-flows/${f.metadata.name}`}
                  style={{ color: 'var(--integration-link)', textDecoration: 'none', fontWeight: 500, fontSize: '13px' }}>
                  {f.metadata.name}
                </a>
                <span style={{ fontSize: '11px', color: '#c9190b', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.status?.message || 'Error'}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Recent Flows */}
        <Card isCompact>
          <CardTitle>Recently Created Flows</CardTitle>
          <CardBody>
            {recentFlows.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>
                No flows yet — <a href="/integration-flows">create your first flow</a> or browse the{' '}
                <a href={`${DOCS_BASE_URL}/ready-flows.html`} target="_blank" rel="noopener noreferrer">Ready Flows catalog</a>.
              </p>
            ) : recentFlows.map(f => (
              <div key={f.metadata.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--integration-border)' }}>
                <a href={`/integration-flows/${f.metadata.name}`}
                  style={{ color: 'var(--integration-link)', textDecoration: 'none', fontSize: '13px' }}>
                  {f.metadata.name}
                </a>
                <span style={{ fontSize: '11px', color: 'var(--integration-text-subtle)' }}>
                  {timeAgo(f.metadata.creationTimestamp)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Recent Pipeline Runs */}
        <Card isCompact>
          <CardTitle>Recent Builds</CardTitle>
          <CardBody>
            {recentPRs.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>No builds yet</p>
            ) : recentPRs.map(pr => {
              const flowLabel = pr.metadata.labels?.['platform.io/flow-name'] || 'unknown';
              const succeeded = (pr.status?.conditions || []).find(c => c.type === 'Succeeded');
              const prStatus = succeeded?.status === 'True' ? 'Succeeded' : succeeded?.status === 'False' ? 'Failed' : 'Running';
              const prLabelColor: LabelColor = prStatus === 'Succeeded' ? 'green' : prStatus === 'Failed' ? 'red' : 'yellow';
              return (
                <div key={pr.metadata.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--integration-border)' }}>
                  <div>
                    <a href={`/k8s/ns/${NAMESPACE}/tekton.dev~v1~PipelineRun/${pr.metadata.name}`}
                      style={{ color: 'var(--integration-link)', textDecoration: 'none', fontSize: '12px' }}>
                      {pr.metadata.name.length > 40 ? pr.metadata.name.substring(0, 40) + '...' : pr.metadata.name}
                    </a>
                    <div style={{ fontSize: '11px', color: 'var(--integration-text-subtle)' }}>Flow: {flowLabel}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Label color={prLabelColor} isCompact>{prStatus}</Label>
                    <div style={{ fontSize: '10px', color: 'var(--integration-text-subtle)' }}>
                      {timeAgo(pr.metadata.creationTimestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>
    </PageSection>
  );
};

export default FlowOverviewPage;
export { FlowOverviewPage };
