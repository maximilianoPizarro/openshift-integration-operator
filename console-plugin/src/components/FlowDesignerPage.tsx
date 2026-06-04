import * as React from 'react';
import TelemetryOverlay from './TelemetryOverlay';
import FlowVisualizer from './FlowVisualizer';

const API_BASE = '/api/kubernetes/apis/platform.io/v1alpha1';
const NAMESPACE = 'openshift-integration';

interface IntegrationFlow {
  metadata: { name: string; namespace: string };
  spec: { engine: string; gitRepository: string; branch: string; kaotoDesign?: string; targetClusters?: string[] };
  status?: { phase: string; message?: string; gitCommitHash?: string; argoApplicationName?: string };
}

function getCsrfToken(): string {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : '';
}

function extractFlowName(): string {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);
  const idx = segments.indexOf('integration-flows');
  if (idx >= 0 && idx + 1 < segments.length) return segments[idx + 1];
  return '';
}

interface FlowDesignerPageProps {
  match?: { params: { name: string } };
}

const phaseDot: Record<string, string> = {
  Running: '#3e8635', Building: '#f0ab00', Scaffolding: '#8476d1',
  Deploying: '#0066cc', PartiallyHealthy: '#f0ab00', Error: '#c9190b',
};

function getKaotoUrl(): string {
  const host = window.location.hostname;
  const consoleParts = host.split('.');
  const domainStart = consoleParts.indexOf('apps');
  if (domainStart > 0) {
    const baseDomain = consoleParts.slice(domainStart).join('.');
    return `https://kaoto-openshift-integration.${baseDomain}`;
  }
  return 'https://kaoto-openshift-integration.apps.cluster.local';
}
const KAOTO_URL = getKaotoUrl();

const FlowDesignerPage: React.FC<FlowDesignerPageProps> = ({ match }) => {
  const flowName = match?.params?.name || extractFlowName();
  const [flow, setFlow] = React.useState<IntegrationFlow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [design, setDesign] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'visual' | 'kaoto' | 'design' | 'spec' | 'status'>('visual');
  const [zoom, setZoom] = React.useState(1);
  const [fullscreen, setFullscreen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const fetchFlow = React.useCallback(async () => {
    if (!flowName) { setError('No flow name'); setLoading(false); return; }
    try {
      const resp = await fetch(`${API_BASE}/namespaces/${NAMESPACE}/integrationflows/${flowName}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: IntegrationFlow = await resp.json();
      setFlow(data);
      if (!design) setDesign(data.spec.kaotoDesign || '');
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [flowName]);

  React.useEffect(() => { fetchFlow(); }, [fetchFlow]);

  const handleSave = async () => {
    if (!flow) return;
    setSaving(true);
    setSaved(false);
    try {
      const patch = [{ op: 'replace', path: '/spec/kaotoDesign', value: design }];
      const resp = await fetch(`${API_BASE}/namespaces/${NAMESPACE}/integrationflows/${flowName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json', 'X-CSRFToken': getCsrfToken() },
        body: JSON.stringify(patch),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${resp.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await fetchFlow();
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const phase = flow?.status?.phase || 'Pending';
  const dot = phaseDot[phase] || '#6a6e73';

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: active ? 600 : 400,
    borderBottom: active ? '2px solid var(--pf-global--primary-color--100, #0066cc)' : '2px solid transparent',
    color: active ? 'var(--pf-global--primary-color--100, #0066cc)' : 'var(--pf-global--Color--200, #6a6e73)',
    backgroundColor: 'transparent', border: 'none',
    borderBottomWidth: '2px', borderBottomStyle: 'solid',
    borderBottomColor: active ? 'var(--pf-global--primary-color--100, #0066cc)' : 'transparent',
  });

  if (loading) return <div className="co-m-pane__body" style={{ padding: '24px' }}><p className="co-help-text">Loading flow...</p></div>;
  if (error || !flow) return (
    <div className="co-m-pane__body" style={{ padding: '24px' }}>
      <div className="pf-c-alert pf-m-danger pf-m-inline" style={{ marginBottom: '16px' }}>
        <h4 className="pf-c-alert__title">Error loading flow &quot;{flowName}&quot;: {error}</h4>
      </div>
      <a href="/integration-flows" className="pf-c-button pf-m-link">&larr; Back to Flows</a>
    </div>
  );

  return (
    <div className="co-m-pane__body" style={{ padding: '24px', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <a href="/integration-flows" className="pf-c-button pf-m-link pf-m-small" style={{ padding: 0, marginBottom: '8px', display: 'inline-block' }}>&larr; Back to Flows</a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="co-m-pane__heading" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              {flow.metadata.name}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 600, padding: '2px 10px', borderRadius: '10px', backgroundColor: dot, color: '#fff' }}>
                {phase}
              </span>
            </h1>
            <span className="co-help-text">
              Engine: <strong>{flow.spec.engine}</strong> &middot; Branch: <strong>{flow.spec.branch}</strong>
              {flow.spec.targetClusters?.length ? <> &middot; Clusters: <strong>{flow.spec.targetClusters.join(', ')}</strong></> : null}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {saved && <span style={{ color: '#3e8635' }}>Saved!</span>}
            <button className="pf-c-button pf-m-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Design'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs + Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', marginBottom: '0' }}>
        <div style={{ display: 'flex' }}>
          <button style={tabStyle(activeTab === 'visual')} onClick={() => setActiveTab('visual')}>Visual Flow</button>
          <button style={tabStyle(activeTab === 'kaoto')} onClick={() => setActiveTab('kaoto')}>Kaoto Designer</button>
          <button style={tabStyle(activeTab === 'design')} onClick={() => setActiveTab('design')}>YAML Editor</button>
          <button style={tabStyle(activeTab === 'spec')} onClick={() => setActiveTab('spec')}>Spec</button>
          <button style={tabStyle(activeTab === 'status')} onClick={() => setActiveTab('status')}>Status</button>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingRight: '4px' }}>
          {(activeTab === 'visual' || activeTab === 'kaoto') && (
            <>
              <button className="pf-c-button pf-m-plain" title="Zoom Out" onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} style={{ fontSize: '16px', padding: '4px 8px' }}>&#x2212;</button>
              <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center', color: 'var(--pf-global--Color--200, #6a6e73)' }}>{Math.round(zoom * 100)}%</span>
              <button className="pf-c-button pf-m-plain" title="Zoom In" onClick={() => setZoom(z => Math.min(3, z + 0.1))} style={{ fontSize: '16px', padding: '4px 8px' }}>+</button>
              <button className="pf-c-button pf-m-plain" title="Reset Zoom" onClick={() => setZoom(1)} style={{ fontSize: '12px', padding: '4px 8px' }}>1:1</button>
            </>
          )}
          <button
            className="pf-c-button pf-m-plain"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            onClick={() => {
              if (!fullscreen && contentRef.current) {
                contentRef.current.requestFullscreen?.();
                setFullscreen(true);
              } else if (document.exitFullscreen) {
                document.exitFullscreen();
                setFullscreen(false);
              }
            }}
            style={{ fontSize: '16px', padding: '4px 8px' }}
          >{fullscreen ? '\u2716' : '\u26F6'}</button>
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} style={{ flex: 1, display: 'flex', gap: '16px', marginTop: '16px', minHeight: 0, backgroundColor: fullscreen ? 'var(--pf-global--BackgroundColor--dark-300, #151515)' : undefined }}>
        <div style={{ flex: 3, border: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'visual' && (
            <div style={{ flex: 1, backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)', overflow: 'auto' }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', minHeight: '100%' }}>
                <FlowVisualizer design={design} engine={flow.spec.engine} />
              </div>
            </div>
          )}
          {activeTab === 'kaoto' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <iframe
                src={KAOTO_URL}
                style={{
                  flex: 1, border: 'none',
                  transform: `scale(${zoom})`, transformOrigin: 'top left',
                  width: `${100 / zoom}%`, height: `${100 / zoom}%`,
                }}
                title="Kaoto Designer"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
              />
            </div>
          )}
          {activeTab === 'design' && (
            <textarea
              value={design}
              onChange={(e) => setDesign(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1, width: '100%', padding: '16px',
                fontFamily: 'var(--pf-global--FontFamily--monospace, "Liberation Mono", consolas, monospace)',
                fontSize: '13px', lineHeight: 1.6, border: 'none', resize: 'none', outline: 'none',
                backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)',
                color: 'var(--pf-global--Color--light-100, #e0e0e0)',
              }}
            />
          )}
          {activeTab === 'spec' && (
            <pre style={{
              flex: 1, margin: 0, padding: '16px', overflow: 'auto',
              fontFamily: 'var(--pf-global--FontFamily--monospace, "Liberation Mono", consolas, monospace)',
              fontSize: '13px', lineHeight: 1.6,
              backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)',
              color: 'var(--pf-global--Color--light-100, #e0e0e0)',
            }}>{JSON.stringify(flow.spec, null, 2)}</pre>
          )}
          {activeTab === 'status' && (
            <pre style={{
              flex: 1, margin: 0, padding: '16px', overflow: 'auto',
              fontFamily: 'var(--pf-global--FontFamily--monospace, "Liberation Mono", consolas, monospace)',
              fontSize: '13px', lineHeight: 1.6,
              backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)',
              color: 'var(--pf-global--Color--light-100, #e0e0e0)',
            }}>{JSON.stringify(flow.status || { phase: 'Pending', message: 'Waiting for reconciliation' }, null, 2)}</pre>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '220px' }}>
          <div style={{ border: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', borderRadius: '6px', padding: '16px' }}>
            <TelemetryOverlay flowId={flowName} />
          </div>
          <SidebarCard label="Git Repository" value={flow.spec.gitRepository || 'Not configured'} />
          <SidebarCard label="Target Clusters" value={(flow.spec.targetClusters || []).join(', ') || 'None'} />
          {flow.status?.gitCommitHash && <SidebarCard label="Last Commit" value={flow.status.gitCommitHash.substring(0, 8)} />}
          {flow.status?.argoApplicationName && <SidebarCard label="ArgoCD App" value={flow.status.argoApplicationName} />}
          {flow.status?.message && (
            <div style={{ border: `1px solid ${phase === 'Error' ? '#c9190b' : 'var(--pf-global--BorderColor--100, #d2d2d2)'}`, borderRadius: '6px', padding: '12px' }}>
              <div className="co-help-text" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Message</div>
              <div style={{ fontSize: '13px', color: phase === 'Error' ? '#c9190b' : 'inherit' }}>{flow.status.message}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SidebarCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ border: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', borderRadius: '6px', padding: '12px' }}>
    <div className="co-help-text" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '13px', wordBreak: 'break-all' }}>{value}</div>
  </div>
);

export default FlowDesignerPage;
export { FlowDesignerPage };
