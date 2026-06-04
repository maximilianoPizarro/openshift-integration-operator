import * as React from 'react';

const API_BASE = '/api/kubernetes/apis/platform.io/v1alpha1';
const NAMESPACE = 'openshift-integration';

interface Condition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

interface ClusterDeployment {
  clusterName: string;
  applicationName?: string;
  syncStatus?: string;
  healthStatus?: string;
  lastSyncTime?: string;
  version?: string;
}

interface IntegrationFlow {
  metadata: { name: string; namespace: string; creationTimestamp: string; uid: string };
  spec: {
    engine: string;
    gitRepository: string;
    branch: string;
    targetClusters?: string[];
    targeting?: { strategy: string; clusters: string[] };
  };
  status?: {
    phase: string;
    message?: string;
    gitCommitHash?: string;
    conditions?: Condition[];
    clusterDeployments?: ClusterDeployment[];
  };
}

function getCsrfToken(): string {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : '';
}

function k8sFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> || {}),
    'X-CSRFToken': getCsrfToken(),
  };
  if (opts.method && opts.method !== 'GET') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  return fetch(url, { ...opts, headers });
}

const ENGINES = ['CAMEL', 'SONATAFLOW'] as const;

const defaultDesign: Record<string, string> = {
  CAMEL: `- route:
    from:
      uri: "timer:tick?period=5000"
      steps:
        - log:
            message: "Hello from Camel integration"
        - to:
            uri: "log:info"`,
  SONATAFLOW: `id: new-workflow
version: "1.0"
specVersion: "0.8"
name: New Workflow
start: InitState
states:
  - name: InitState
    type: operation
    actions:
      - functionRef: myFunction
    end: true`,
};

const phaseDot: Record<string, string> = {
  Running: '#3e8635', Building: '#f0ab00', Scaffolding: '#8476d1',
  Deploying: '#0066cc', PartiallyHealthy: '#f0ab00', Error: '#c9190b',
};

const conditionColor = (status: string) => {
  if (status === 'True') return '#3e8635';
  if (status === 'False') return '#c9190b';
  return '#6a6e73';
};

function clusterSummary(deployments: ClusterDeployment[] | undefined): string {
  if (!deployments?.length) return '—';
  const healthy = deployments.filter(d => d.healthStatus === 'Healthy').length;
  return `${healthy}/${deployments.length}`;
}

const thStyle: React.CSSProperties = { padding: '8px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--pf-global--Color--200, #8a8d90)', letterSpacing: '0.03em' };
const tdStyle: React.CSSProperties = { padding: '10px 16px', fontSize: '14px', verticalAlign: 'middle' };

const IntegrationFlowPage: React.FC = () => {
  const [flows, setFlows] = React.useState<IntegrationFlow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newEngine, setNewEngine] = React.useState<string>('CAMEL');
  const [creating, setCreating] = React.useState(false);

  const fetchFlows = React.useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/namespaces/${NAMESPACE}/integrationflows`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setFlows(data.items || []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchFlows();
    const interval = setInterval(fetchFlows, 5000);
    return () => clearInterval(interval);
  }, [fetchFlows]);

  const handleCreate = async () => {
    const flowName = newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '');
    if (!flowName) return;
    setCreating(true);
    try {
      const newFlow = {
        apiVersion: 'platform.io/v1alpha1',
        kind: 'IntegrationFlow',
        metadata: { name: flowName, namespace: NAMESPACE },
        spec: {
          engine: newEngine,
          gitRepository: `https://gitea-gitea.apps.cluster-xtvzv.dynamic.redhatworkshops.io/user1/${flowName}`,
          branch: 'main',
          kaotoDesign: defaultDesign[newEngine] || '',
          targeting: {
            strategy: 'explicit',
            clusters: ['local'],
          },
        },
      };
      const resp = await k8sFetch(`${API_BASE}/namespaces/${NAMESPACE}/integrationflows`, {
        method: 'POST',
        body: JSON.stringify(newFlow),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${resp.status}`);
      }
      setShowCreate(false);
      setNewName('');
      await fetchFlows();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const resp = await k8sFetch(`${API_BASE}/namespaces/${NAMESPACE}/integrationflows/${name}`, {
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await fetchFlows();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  return (
    <div className="co-m-pane__body" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="co-m-pane__heading" style={{ margin: 0 }}>Integration Flows</h1>
          <span className="co-help-text">{flows.length} flow{flows.length !== 1 ? 's' : ''} in {NAMESPACE}</span>
        </div>
        <button className={showCreate ? 'pf-c-button pf-m-secondary' : 'pf-c-button pf-m-primary'} onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Flow'}
        </button>
      </div>

      {error && (
        <div className="pf-c-alert pf-m-danger pf-m-inline" style={{ marginBottom: '16px' }}>
          <div className="pf-c-alert__icon"><i className="fas fa-exclamation-circle" /></div>
          <h4 className="pf-c-alert__title">Error loading flows: {error}</h4>
        </div>
      )}

      {showCreate && (
        <div style={{ padding: '16px', borderRadius: '6px', marginBottom: '20px', border: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', background: 'var(--pf-global--BackgroundColor--200, #f0f0f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              className="pf-c-form-control"
              style={{ width: '240px' }}
              placeholder="flow-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <select className="pf-c-form-control" style={{ width: '160px' }} value={newEngine} onChange={(e) => setNewEngine(e.target.value)}>
              {ENGINES.map((eng) => <option key={eng} value={eng}>{eng}</option>)}
            </select>
            <button className="pf-c-button pf-m-primary" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="co-help-text">Loading flows...</p>
      ) : flows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2>No IntegrationFlows found</h2>
          <p className="co-help-text">Click Create Flow to get started</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
              <th style={{ ...thStyle, width: '20%' }}>Name</th>
              <th style={{ ...thStyle, width: '10%' }}>Engine</th>
              <th style={{ ...thStyle, width: '12%' }}>Phase</th>
              <th style={{ ...thStyle, width: '8%' }}>Clusters</th>
              <th style={{ ...thStyle, width: '10%' }}>Conditions</th>
              <th style={{ ...thStyle, width: '18%' }}>Repository</th>
              <th style={{ ...thStyle, width: '8%' }}>Age</th>
              <th style={{ ...thStyle, width: '14%', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((flow) => {
              const phase = flow.status?.phase || 'Pending';
              const dot = phaseDot[phase] || '#6a6e73';
              const conditions = flow.status?.conditions || [];
              return (
                <tr key={flow.metadata.uid || flow.metadata.name} className="co-resource-list__item" style={{ borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
                  <td style={tdStyle}>
                    <a href={`/integration-flows/${flow.metadata.name}`} style={{ color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none' }}>{flow.metadata.name}</a>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ padding: '3px 10px', borderRadius: '3px', fontSize: '12px', fontWeight: 600, backgroundColor: flow.spec.engine === 'CAMEL' ? 'rgba(232, 89, 12, 0.2)' : 'rgba(47, 158, 68, 0.2)', color: flow.spec.engine === 'CAMEL' ? '#f0ab00' : '#5ba352' }}>
                      {flow.spec.engine}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: dot, display: 'inline-block', flexShrink: 0 }} />
                      {phase}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--pf-global--Color--200, #8a8d90)', fontSize: '13px' }}>
                      {clusterSummary(flow.status?.clusterDeployments)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {conditions.length === 0 ? (
                      <span style={{ color: 'var(--pf-global--Color--200, #8a8d90)' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {conditions.map((c) => (
                          <span
                            key={c.type}
                            title={`${c.type}: ${c.status}${c.reason ? ` (${c.reason})` : ''}${c.message ? ` — ${c.message}` : ''}`}
                            style={{
                              width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                              backgroundColor: conditionColor(c.status),
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {flow.spec.gitRepository ? (
                      <a href={flow.spec.gitRepository} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none', fontSize: '13px' }}>
                        {flow.spec.gitRepository.split('/').slice(-2).join('/')} <span style={{ fontSize: '11px', opacity: 0.6 }}>{'\u2197'}</span>
                      </a>
                    ) : <span style={{ color: 'var(--pf-global--Color--200, #8a8d90)' }}>{'\u2014'}</span>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--pf-global--Color--200, #8a8d90)' }}>{timeAgo(flow.metadata.creationTimestamp)}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <a href={`/integration-flows/${flow.metadata.name}`} className="pf-c-button pf-m-link pf-m-small" style={{ textDecoration: 'none' }}>Edit</a>
                      <button className="pf-c-button pf-m-plain pf-m-small" onClick={() => handleDelete(flow.metadata.name)} title="Delete" style={{ color: '#c9190b' }}>
                        {'\u2716'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

function timeAgo(ts: string): string {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export default IntegrationFlowPage;
export { IntegrationFlowPage };
