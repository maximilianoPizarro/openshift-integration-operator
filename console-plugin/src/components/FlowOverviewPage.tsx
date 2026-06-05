import * as React from 'react';

const API_BASE = '/api/kubernetes/apis/platform.io/v1alpha1';
const K8S_TEKTON = '/api/kubernetes/apis/tekton.dev/v1';
const K8S_ARGO = '/api/kubernetes/apis/argoproj.io/v1alpha1';
const NAMESPACE = 'openshift-integration';

interface IntegrationFlow {
  metadata: { name: string; namespace: string; creationTimestamp: string; uid: string };
  spec: { engine: string; integrationType?: string; gitRepository: string; branch: string };
  status?: { phase: string; message?: string; gitCommitHash?: string; argoApplicationName?: string; applicationSetName?: string };
}

interface PipelineRun {
  metadata: { name: string; creationTimestamp: string; labels?: Record<string, string> };
  status?: { conditions?: Array<{ type: string; status: string; reason?: string }>; completionTime?: string; startTime?: string };
}

const TYPES = [
  { value: 'CAMEL_ROUTE', label: 'Camel Route', color: '#f0ab00' },
  { value: 'CAMEL_KAMELET', label: 'Kamelet', color: '#8476d1' },
  { value: 'CAMEL_PIPE', label: 'Pipe', color: '#2b9af3' },
  { value: 'CAMEL_TEST', label: 'Test', color: '#3e8635' },
  { value: 'SONATAFLOW', label: 'SonataFlow', color: '#009596' },
];

const PHASES = [
  { value: 'Running', color: '#3e8635' },
  { value: 'Building', color: '#f0ab00' },
  { value: 'Deploying', color: '#0066cc' },
  { value: 'Scaffolding', color: '#8476d1' },
  { value: 'Paused', color: '#f0ab00' },
  { value: 'Error', color: '#c9190b' },
  { value: 'Stopped', color: '#6a6e73' },
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

const cardStyle: React.CSSProperties = {
  padding: '16px', borderRadius: '8px',
  border: '1px solid var(--pf-global--BorderColor--100, #3c3f42)',
  backgroundColor: 'var(--pf-global--BackgroundColor--200, #151515)',
};

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

  if (loading) return <div className="co-m-pane__body" style={{ padding: '24px' }}><p className="co-help-text">Loading overview...</p></div>;

  return (
    <div className="co-m-pane__body" style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 className="co-m-pane__heading" style={{ margin: 0, fontSize: '20px' }}>Flow Overview</h1>
        <span className="co-help-text" style={{ fontSize: '12px' }}>
          Dashboard for {flows.length} integration flows in {NAMESPACE}
        </span>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <a href="/integration-flows" style={{ textDecoration: 'none', ...cardStyle, borderLeft: '3px solid #2b9af3' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#2b9af3' }}>{flows.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Total Flows</div>
        </a>
        <div style={{ ...cardStyle, borderLeft: '3px solid #3e8635' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#3e8635' }}>{runningFlows.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Running</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: `3px solid ${errorFlows.length > 0 ? '#c9190b' : '#3e8635'}` }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: errorFlows.length > 0 ? '#c9190b' : '#3e8635' }}>{errorFlows.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Errors</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '3px solid #f0ab00' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#f0ab00' }}>{pipelineRuns.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Builds</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* By Type */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Flows by Type</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {TYPES.map(t => {
              const count = typeCounts[t.value] || 0;
              const pct = flows.length > 0 ? (count / flows.length) * 100 : 0;
              return (
                <div key={t.value}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: t.color }}>{t.label}</span>
                    <span style={{ color: 'var(--pf-global--Color--200, #6a6e73)' }}>{count}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)' }}>
                    <div style={{ height: '100%', borderRadius: '3px', backgroundColor: t.color, width: `${pct}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Phase */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Flows by Phase</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PHASES.map(p => {
              const count = phaseCounts[p.value] || 0;
              const pct = flows.length > 0 ? (count / flows.length) * 100 : 0;
              return (
                <div key={p.value}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: p.color }}>{p.value}</span>
                    <span style={{ color: 'var(--pf-global--Color--200, #6a6e73)' }}>{count}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)' }}>
                    <div style={{ height: '100%', borderRadius: '3px', backgroundColor: p.color, width: `${pct}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error Flows */}
      {errorFlows.length > 0 && (
        <div style={{ ...cardStyle, borderLeft: '3px solid #c9190b', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#c9190b' }}>
            {'\u26A0'} Flows with Errors ({errorFlows.length})
          </h3>
          {errorFlows.map(f => (
            <div key={f.metadata.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
              <a href={`/integration-flows/${f.metadata.name}`}
                style={{ color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none', fontWeight: 500, fontSize: '13px' }}>
                {f.metadata.name}
              </a>
              <span style={{ fontSize: '11px', color: '#c9190b', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.status?.message || 'Error'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Recent Flows */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Recently Created Flows</h3>
          {recentFlows.map(f => (
            <div key={f.metadata.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
              <a href={`/integration-flows/${f.metadata.name}`}
                style={{ color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none', fontSize: '13px' }}>
                {f.metadata.name}
              </a>
              <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                {timeAgo(f.metadata.creationTimestamp)}
              </span>
            </div>
          ))}
        </div>

        {/* Recent Pipeline Runs */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Recent Builds</h3>
          {recentPRs.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>No builds yet</p>
          ) : recentPRs.map(pr => {
            const flowLabel = pr.metadata.labels?.['platform.io/flow-name'] || 'unknown';
            const succeeded = (pr.status?.conditions || []).find(c => c.type === 'Succeeded');
            const prStatus = succeeded?.status === 'True' ? 'Succeeded' : succeeded?.status === 'False' ? 'Failed' : 'Running';
            const prColor = prStatus === 'Succeeded' ? '#3e8635' : prStatus === 'Failed' ? '#c9190b' : '#f0ab00';
            return (
              <div key={pr.metadata.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
                <div>
                  <a href={`/k8s/ns/${NAMESPACE}/tekton.dev~v1~PipelineRun/${pr.metadata.name}`}
                    style={{ color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none', fontSize: '12px' }}>
                    {pr.metadata.name.length > 40 ? pr.metadata.name.substring(0, 40) + '...' : pr.metadata.name}
                  </a>
                  <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Flow: {flowLabel}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: prColor }}>{prStatus}</span>
                  <div style={{ fontSize: '10px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                    {timeAgo(pr.metadata.creationTimestamp)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FlowOverviewPage;
export { FlowOverviewPage };
