import * as React from 'react';

const API_BASE = '/api/kubernetes/apis/platform.io/v1alpha1';
const K8S_BASE = '/api/kubernetes/apis';
const NAMESPACE = 'openshift-integration';
const PAGE_SIZE = 10;

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
  metadata: { name: string; namespace: string; creationTimestamp: string; uid: string; labels?: Record<string, string> };
  spec: {
    engine: string;
    integrationType?: string;
    gitRepository: string;
    branch: string;
    targetClusters?: string[];
    targeting?: { strategy: string; clusters: string[] };
  };
  status?: {
    phase: string;
    message?: string;
    gitCommitHash?: string;
    argoApplicationName?: string;
    applicationSetName?: string;
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

const INTEGRATION_TYPES = [
  { value: 'CAMEL_ROUTE', label: 'Camel Route', color: '#f0ab00', bgColor: 'rgba(232,89,12,0.2)', icon: '\u2699' },
  { value: 'CAMEL_KAMELET', label: 'Kamelet', color: '#8476d1', bgColor: 'rgba(137,87,229,0.15)', icon: '\u2B29' },
  { value: 'CAMEL_PIPE', label: 'Pipe', color: '#2b9af3', bgColor: 'rgba(56,139,253,0.15)', icon: '\u2192' },
  { value: 'CAMEL_TEST', label: 'Test', color: '#3e8635', bgColor: 'rgba(47,158,68,0.15)', icon: '\u2713' },
  { value: 'SONATAFLOW', label: 'SonataFlow', color: '#009596', bgColor: 'rgba(0,149,150,0.15)', icon: '\u29BF' },
] as const;

const PHASE_ALL = [
  { value: '', label: 'All Phases' },
  { value: 'Running', label: 'Running' },
  { value: 'Deploying', label: 'Deploying' },
  { value: 'Building', label: 'Building' },
  { value: 'Scaffolding', label: 'Scaffolding' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Error', label: 'Error' },
];

const defaultDesign: Record<string, string> = {
  CAMEL_ROUTE: `- route:\n    id: new-route\n    from:\n      uri: "timer:tick?period=5000"\n      steps:\n        - log:\n            message: "Hello from Camel Route"\n        - to:\n            uri: "log:info"`,
  CAMEL_KAMELET: `apiVersion: camel.apache.org/v1\nkind: Kamelet\nmetadata:\n  name: custom-source\n  labels:\n    camel.apache.org/kamelet.type: source\nspec:\n  definition:\n    title: Custom Source\n    properties:\n      message:\n        title: Message\n        type: string\n        default: "Hello from Kamelet"\n  template:\n    from:\n      uri: "timer:tick?period=5000"\n      steps:\n        - setBody:\n            simple: "{{message}}"\n        - to: "kamelet:sink"`,
  CAMEL_PIPE: `apiVersion: camel.apache.org/v1\nkind: Pipe\nmetadata:\n  name: source-to-sink\nspec:\n  source:\n    ref:\n      apiVersion: camel.apache.org/v1\n      kind: Kamelet\n      name: timer-source\n    properties:\n      message: "Hello from Pipe"\n  sink:\n    ref:\n      apiVersion: camel.apache.org/v1\n      kind: Kamelet\n      name: log-sink`,
  CAMEL_TEST: `test:\n  name: route-test\n  description: "Verify route processes messages"\n  from:\n    uri: "direct:test-input"\n    body: \'{"event":"test"}\'\n  assertions:\n    - endpoint: "mock:output"\n      expectedCount: 1\n  timeout: 30000`,
  SONATAFLOW: `id: new-workflow\nversion: "1.0"\nspecVersion: "0.8"\nname: New Workflow\nstart: InitState\nstates:\n  - name: InitState\n    type: operation\n    actions:\n      - functionRef: myFunction\n    end: true`,
};

const phaseMeta: Record<string, { color: string; icon: string }> = {
  Running: { color: '#3e8635', icon: '\u25CF' },
  Building: { color: '#f0ab00', icon: '\u29D7' },
  Scaffolding: { color: '#8476d1', icon: '\u2692' },
  Deploying: { color: '#0066cc', icon: '\u21BB' },
  PartiallyHealthy: { color: '#f0ab00', icon: '\u26A0' },
  Error: { color: '#c9190b', icon: '\u2716' },
  Pending: { color: '#6a6e73', icon: '\u25CB' },
};

const conditionColor = (status: string) => {
  if (status === 'True') return '#3e8635';
  if (status === 'False') return '#c9190b';
  return '#6a6e73';
};

function consoleUrl(path: string): string {
  return `/k8s/ns/${NAMESPACE}/${path}`;
}

function clusterSummary(deployments: ClusterDeployment[] | undefined): string {
  if (!deployments?.length) return '\u2014';
  const healthy = deployments.filter(d => d.healthStatus === 'Healthy').length;
  return `${healthy}/${deployments.length}`;
}

const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--pf-global--Color--200, #8a8d90)', letterSpacing: '0.05em', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', verticalAlign: 'middle' };
const badgeBase: React.CSSProperties = { padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' };
const linkBtn: React.CSSProperties = { fontSize: '11px', padding: '2px 6px', borderRadius: '3px', textDecoration: 'none', border: '1px solid var(--pf-global--BorderColor--100, #3c3f42)', color: 'var(--pf-global--link--Color, #2b9af3)', backgroundColor: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' };

const IntegrationFlowPage: React.FC = () => {
  const [flows, setFlows] = React.useState<IntegrationFlow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newEngine, setNewEngine] = React.useState<string>('CAMEL_ROUTE');
  const [creating, setCreating] = React.useState(false);

  const [search, setSearch] = React.useState('');
  const [filterType, setFilterType] = React.useState('');
  const [filterPhase, setFilterPhase] = React.useState('');
  const [page, setPage] = React.useState(1);

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

  const filtered = React.useMemo(() => {
    let result = flows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.metadata.name.toLowerCase().includes(q) ||
        (f.spec.gitRepository || '').toLowerCase().includes(q) ||
        (f.status?.message || '').toLowerCase().includes(q)
      );
    }
    if (filterType) {
      result = result.filter(f => {
        const t = f.spec.integrationType || (f.spec.engine === 'CAMEL' ? 'CAMEL_ROUTE' : 'SONATAFLOW');
        return t === filterType;
      });
    }
    if (filterPhase) {
      result = result.filter(f => (f.status?.phase || 'Pending') === filterPhase);
    }
    return result;
  }, [flows, search, filterType, filterPhase]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  React.useEffect(() => { setPage(1); }, [search, filterType, filterPhase]);

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
          integrationType: newEngine,
          engine: newEngine.startsWith('CAMEL') ? 'CAMEL' : 'SONATAFLOW',
          gitRepository: `https://gitea-gitea.apps.cluster-xtvzv.dynamic.redhatworkshops.io/user1/${flowName}`,
          branch: 'main',
          kaotoDesign: defaultDesign[newEngine] || '',
          targeting: { strategy: 'explicit', clusters: ['local'] },
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
      const resp = await k8sFetch(`${API_BASE}/namespaces/${NAMESPACE}/integrationflows/${name}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await fetchFlows();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

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

  return (
    <div className="co-m-pane__body" style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 className="co-m-pane__heading" style={{ margin: 0, fontSize: '20px' }}>Integration Flows</h1>
          <span className="co-help-text" style={{ fontSize: '12px' }}>{flows.length} flow{flows.length !== 1 ? 's' : ''} in {NAMESPACE}</span>
        </div>
        <button className={showCreate ? 'pf-c-button pf-m-secondary' : 'pf-c-button pf-m-primary'} onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ Create Flow'}
        </button>
      </div>

      {/* Summary labels */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {INTEGRATION_TYPES.map(t => {
          const count = typeCounts[t.value] || 0;
          if (count === 0) return null;
          const active = filterType === t.value;
          return (
            <button key={t.value} onClick={() => setFilterType(active ? '' : t.value)}
              style={{ ...badgeBase, backgroundColor: active ? t.bgColor : 'transparent', color: t.color,
                border: `1px solid ${active ? t.color : 'var(--pf-global--BorderColor--100, #3c3f42)'}`, cursor: 'pointer',
                opacity: active ? 1 : 0.7 }}>
              {t.icon} {t.label} <strong>{count}</strong>
            </button>
          );
        })}
        <span style={{ width: 1, backgroundColor: 'var(--pf-global--BorderColor--100, #3c3f42)', margin: '0 4px' }} />
        {Object.entries(phaseCounts).map(([ph, count]) => {
          const meta = phaseMeta[ph] || phaseMeta.Pending;
          const active = filterPhase === ph;
          return (
            <button key={ph} onClick={() => setFilterPhase(active ? '' : ph)}
              style={{ ...badgeBase, backgroundColor: 'transparent', color: meta.color,
                border: `1px solid ${active ? meta.color : 'var(--pf-global--BorderColor--100, #3c3f42)'}`, cursor: 'pointer',
                opacity: active ? 1 : 0.7 }}>
              {meta.icon} {ph} <strong>{count}</strong>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="pf-c-alert pf-m-danger pf-m-inline" style={{ marginBottom: '12px' }}>
          <div className="pf-c-alert__icon"><i className="fas fa-exclamation-circle" /></div>
          <h4 className="pf-c-alert__title">Error loading flows: {error}</h4>
        </div>
      )}

      {showCreate && (
        <div style={{ padding: '14px', borderRadius: '6px', marginBottom: '14px', border: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', background: 'var(--pf-global--BackgroundColor--200, #f0f0f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input className="pf-c-form-control" style={{ width: '220px' }} placeholder="flow-name" value={newName}
              onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
            <select className="pf-c-form-control" style={{ width: '150px' }} value={newEngine} onChange={(e) => setNewEngine(e.target.value)}>
              {INTEGRATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button className="pf-c-button pf-m-primary" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '360px' }}>
          <input className="pf-c-form-control" placeholder={'\uD83D\uDD0D Search flows by name, repo, or message...'}
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '12px', width: '100%', fontSize: '13px' }} />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pf-global--Color--200, #6a6e73)', fontSize: '14px' }}>
              {'\u2716'}
            </button>
          )}
        </div>
        <select className="pf-c-form-control" style={{ width: '140px', fontSize: '13px' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {INTEGRATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="pf-c-form-control" style={{ width: '130px', fontSize: '13px' }} value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)}>
          {PHASE_ALL.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {(search || filterType || filterPhase) && (
          <button className="pf-c-button pf-m-link pf-m-small" onClick={() => { setSearch(''); setFilterType(''); setFilterPhase(''); }}
            style={{ fontSize: '12px' }}>Clear filters</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <p className="co-help-text">Loading flows...</p>
      ) : paged.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h2 style={{ fontSize: '16px' }}>{flows.length === 0 ? 'No IntegrationFlows found' : 'No flows match filters'}</h2>
          <p className="co-help-text">{flows.length === 0 ? 'Click Create Flow to get started' : 'Try adjusting your search or filters'}</p>
        </div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
                <th style={{ ...thStyle, width: '18%' }}>Name</th>
                <th style={{ ...thStyle, width: '9%' }}>Type</th>
                <th style={{ ...thStyle, width: '10%' }}>Phase</th>
                <th style={{ ...thStyle, width: '7%' }}>Clusters</th>
                <th style={{ ...thStyle, width: '8%' }}>Conditions</th>
                <th style={{ ...thStyle, width: '16%' }}>Repository</th>
                <th style={{ ...thStyle, width: '16%' }}>Resources</th>
                <th style={{ ...thStyle, width: '6%' }}>Age</th>
                <th style={{ ...thStyle, width: '10%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((flow) => {
                const phase = flow.status?.phase || 'Pending';
                const meta = phaseMeta[phase] || phaseMeta.Pending;
                const conditions = flow.status?.conditions || [];
                const typeInfo = INTEGRATION_TYPES.find(t => t.value === (flow.spec.integrationType || (flow.spec.engine === 'CAMEL' ? 'CAMEL_ROUTE' : 'SONATAFLOW')));
                const flowName = flow.metadata.name;
                return (
                  <tr key={flow.metadata.uid || flowName} style={{ borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
                    <td style={tdStyle}>
                      <a href={`/integration-flows/${flowName}`}
                        style={{ color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none', fontWeight: 500 }}>
                        {flowName}
                      </a>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ ...badgeBase, backgroundColor: typeInfo?.bgColor, color: typeInfo?.color }}>
                        {typeInfo?.icon} {typeInfo?.label || flow.spec.engine}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: meta.color, fontWeight: 500, fontSize: '12px' }}>
                        {meta.icon} {phase}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--pf-global--Color--200, #8a8d90)', fontSize: '12px' }}>
                        {clusterSummary(flow.status?.clusterDeployments)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {conditions.length === 0 ? (
                        <span style={{ color: 'var(--pf-global--Color--200, #8a8d90)' }}>{'\u2014'}</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                          {conditions.map((c) => (
                            <span key={c.type}
                              title={`${c.type}: ${c.status}${c.reason ? ` (${c.reason})` : ''}${c.message ? ` \u2014 ${c.message}` : ''}`}
                              style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', backgroundColor: conditionColor(c.status) }} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {flow.spec.gitRepository ? (
                        <a href={flow.spec.gitRepository} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none', fontSize: '12px' }}>
                          {flow.spec.gitRepository.split('/').slice(-2).join('/')} {'\u2197'}
                        </a>
                      ) : <span style={{ color: 'var(--pf-global--Color--200, #8a8d90)' }}>{'\u2014'}</span>}
                      {flow.status?.gitCommitHash && (
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', fontFamily: 'monospace' }}>
                          @{flow.status.gitCommitHash.substring(0, 7)}
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <a href={consoleUrl(`pods?labelSelector=platform.io%2Fflow-name%3D${flowName}`)}
                          style={linkBtn} title="View Pods">
                          {'\u25A3'} Pods
                        </a>
                        <a href={consoleUrl(`tekton.dev~v1~PipelineRun?labelSelector=platform.io%2Fflow-name%3D${flowName}`)}
                          style={linkBtn} title="View PipelineRuns">
                          {'\u29D7'} Pipelines
                        </a>
                        {flow.status?.argoApplicationName && (
                          <a href={`/k8s/ns/openshift-gitops/argoproj.io~v1alpha1~Application/${flow.status.argoApplicationName}`}
                            style={linkBtn} title="View ArgoCD Application">
                            {'\u21BB'} Argo
                          </a>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--pf-global--Color--200, #8a8d90)', fontSize: '12px' }}>{timeAgo(flow.metadata.creationTimestamp)}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <a href={`/integration-flows/${flowName}`} style={{ ...linkBtn, color: 'var(--pf-global--link--Color, #2b9af3)' }}>Edit</a>
                        <button onClick={() => handleDelete(flowName)} title="Delete"
                          style={{ ...linkBtn, color: '#c9190b', borderColor: '#c9190b22' }}>{'\u2716'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '8px 0' }}>
              <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                Showing {(safePage - 1) * PAGE_SIZE + 1}\u2013{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button className="pf-c-button pf-m-plain pf-m-small" disabled={safePage <= 1}
                  onClick={() => setPage(1)} style={{ fontSize: '12px', padding: '4px 8px' }}>{'\u00AB'}</button>
                <button className="pf-c-button pf-m-plain pf-m-small" disabled={safePage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))} style={{ fontSize: '12px', padding: '4px 8px' }}>{'\u2039'}</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    typeof p === 'string' ? (
                      <span key={`e${i}`} style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)', padding: '0 4px' }}>{p}</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p)}
                        style={{
                          fontSize: '12px', padding: '4px 10px', borderRadius: '3px', cursor: 'pointer', border: 'none',
                          backgroundColor: p === safePage ? 'var(--pf-global--primary-color--100, #0066cc)' : 'transparent',
                          color: p === safePage ? '#fff' : 'var(--pf-global--link--Color, #2b9af3)', fontWeight: p === safePage ? 600 : 400,
                        }}>{p}</button>
                    )
                  )}
                <button className="pf-c-button pf-m-plain pf-m-small" disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ fontSize: '12px', padding: '4px 8px' }}>{'\u203A'}</button>
                <button className="pf-c-button pf-m-plain pf-m-small" disabled={safePage >= totalPages}
                  onClick={() => setPage(totalPages)} style={{ fontSize: '12px', padding: '4px 8px' }}>{'\u00BB'}</button>
              </div>
            </div>
          )}
        </>
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
