import * as React from 'react';
import TelemetryOverlay from './TelemetryOverlay';
import FlowVisualizer from './FlowVisualizer';
import type { FlowNode } from './FlowVisualizer';

const API_BASE = '/api/kubernetes/apis/platform.io/v1alpha1';
const NAMESPACE = 'openshift-integration';

interface IntegrationFlow {
  metadata: { name: string; namespace: string };
  spec: { engine: string; integrationType?: string; gitRepository: string; branch: string; kaotoDesign?: string; targetClusters?: string[] };
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

function getBaseAppsDomain(): string {
  const host = window.location.hostname;
  const parts = host.split('.');
  const appsIdx = parts.indexOf('apps');
  if (appsIdx > 0) return parts.slice(appsIdx).join('.');
  return 'apps.cluster.local';
}

function getKaotoUrl(): string {
  return `https://kaoto-openshift-integration.${getBaseAppsDomain()}`;
}

function getSonataFlowConsoleUrl(): string {
  return `https://sonataflow-management-console-kogito-bpm.${getBaseAppsDomain()}`;
}

const KAOTO_URL = getKaotoUrl();
const SONATAFLOW_CONSOLE_URL = getSonataFlowConsoleUrl();

type TabId = 'visual' | 'kaoto' | 'sonataflow' | 'design' | 'spec' | 'status';

const resourceLinkStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '4px', fontSize: '13px',
  textDecoration: 'none', color: 'var(--pf-global--link--Color, #2b9af3)',
  border: '1px solid var(--pf-global--BorderColor--100, #3c3f42)', backgroundColor: 'transparent',
};

const FlowDesignerPage: React.FC<FlowDesignerPageProps> = ({ match }) => {
  const flowName = match?.params?.name || extractFlowName();
  const [flow, setFlow] = React.useState<IntegrationFlow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [design, setDesign] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabId>('visual');
  const [zoom, setZoom] = React.useState(1);
  const [fullscreen, setFullscreen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<HTMLTextAreaElement>(null);
  const [selectedYamlRange, setSelectedYamlRange] = React.useState<{ start: number; end: number } | null>(null);

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

  const handleNodeClick = React.useCallback((node: FlowNode) => {
    setSelectedYamlRange({ start: node.yamlLineStart, end: node.yamlLineEnd });
  }, []);

  const isSonataFlow = flow?.spec.integrationType === 'SONATAFLOW' || flow?.spec.engine === 'SONATAFLOW';
  const phase = flow?.status?.phase || 'Pending';
  const dot = phaseDot[phase] || '#6a6e73';

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: active ? 600 : 400,
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

  const designLines = design.split('\n');

  return (
    <div className="co-m-pane__body" style={{ padding: '24px', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <a href="/integration-flows" className="pf-c-button pf-m-link pf-m-small" style={{ padding: 0, marginBottom: '6px', display: 'inline-block' }}>&larr; Back to Flows</a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="co-m-pane__heading" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' }}>
              {flow.metadata.name}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, padding: '2px 10px', borderRadius: '10px', backgroundColor: dot, color: '#fff' }}>
                {phase}
              </span>
            </h1>
            <span className="co-help-text" style={{ fontSize: '12px' }}>
              Engine: <strong>{flow.spec.integrationType || flow.spec.engine}</strong> &middot; Branch: <strong>{flow.spec.branch}</strong>
              {flow.spec.targetClusters?.length ? <> &middot; Clusters: <strong>{flow.spec.targetClusters.join(', ')}</strong></> : null}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {saved && <span style={{ color: '#3e8635', fontSize: '13px' }}>Saved!</span>}
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
          {!isSonataFlow && <button style={tabStyle(activeTab === 'kaoto')} onClick={() => setActiveTab('kaoto')}>Kaoto Designer</button>}
          {isSonataFlow && <button style={tabStyle(activeTab === 'sonataflow')} onClick={() => setActiveTab('sonataflow')}>SonataFlow Console</button>}
          <button style={tabStyle(activeTab === 'design')} onClick={() => setActiveTab('design')}>YAML Editor</button>
          <button style={tabStyle(activeTab === 'spec')} onClick={() => setActiveTab('spec')}>Spec</button>
          <button style={tabStyle(activeTab === 'status')} onClick={() => setActiveTab('status')}>Status</button>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingRight: '4px' }}>
          {(activeTab === 'visual' || activeTab === 'kaoto' || activeTab === 'sonataflow') && (
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
      <div ref={contentRef} style={{ flex: 1, display: 'flex', gap: '0', marginTop: '0', minHeight: 0, backgroundColor: fullscreen ? 'var(--pf-global--BackgroundColor--dark-300, #151515)' : undefined }}>
        {/* Main area: Visual + YAML side-by-side when node selected */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', border: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', borderRadius: '6px 0 0 6px', overflow: 'hidden' }}>
          {activeTab === 'visual' && (
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Visual panel */}
              <div style={{ flex: selectedYamlRange ? 1 : 1, backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)', overflow: 'auto' }}>
                <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', minHeight: '100%' }}>
                  <FlowVisualizer design={design} engine={flow.spec.engine} onNodeClick={handleNodeClick} />
                </div>
              </div>
              {/* YAML highlight panel */}
              {selectedYamlRange && (
                <div style={{ width: '340px', borderLeft: '1px solid var(--pf-global--BorderColor--100, #3c3f42)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)' }}>
                  <div style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', fontWeight: 600, textTransform: 'uppercase' }}>
                      YAML &middot; Lines {selectedYamlRange.start + 1}&ndash;{selectedYamlRange.end + 1}
                    </span>
                    <button onClick={() => setSelectedYamlRange(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--pf-global--Color--200, #6a6e73)', cursor: 'pointer', fontSize: '12px' }}>{'\u2716'}</button>
                  </div>
                  <pre style={{ flex: 1, margin: 0, padding: '8px', overflow: 'auto', fontSize: '12px', lineHeight: 1.6, fontFamily: 'var(--pf-global--FontFamily--monospace, monospace)', color: 'var(--pf-global--Color--light-100, #e0e0e0)' }}>
                    {designLines.map((line, idx) => {
                      const inRange = idx >= selectedYamlRange.start && idx <= selectedYamlRange.end;
                      return (
                        <div key={idx} style={{
                          backgroundColor: inRange ? 'rgba(0,102,204,0.2)' : 'transparent',
                          borderLeft: inRange ? '3px solid #0066cc' : '3px solid transparent',
                          paddingLeft: '6px',
                        }}>
                          <span style={{ display: 'inline-block', width: '28px', textAlign: 'right', marginRight: '8px', color: '#6a6e73', fontSize: '10px', userSelect: 'none' }}>{idx + 1}</span>
                          {line || ' '}
                        </div>
                      );
                    })}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'kaoto' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '6px 10px', display: 'flex', gap: '8px', alignItems: 'center', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)', backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)' }}>
                <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                  Kaoto Designer &mdash; <strong>{flowName}</strong>
                </span>
                <a href={KAOTO_URL} target="_blank" rel="noopener noreferrer"
                  className="pf-c-button pf-m-link pf-m-small" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                  Open in new tab &#x2197;
                </a>
              </div>
              <iframe src={KAOTO_URL}
                style={{ flex: 1, border: 'none', transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
                title="Kaoto Designer" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals" />
            </div>
          )}

          {activeTab === 'sonataflow' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '6px 10px', display: 'flex', gap: '8px', alignItems: 'center', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)', backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)' }}>
                <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                  SonataFlow Management Console &mdash; <strong>{flowName}</strong>
                </span>
                <a href={SONATAFLOW_CONSOLE_URL} target="_blank" rel="noopener noreferrer"
                  className="pf-c-button pf-m-link pf-m-small" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                  Open in new tab &#x2197;
                </a>
              </div>
              <iframe src={SONATAFLOW_CONSOLE_URL}
                style={{ flex: 1, border: 'none', transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
                title="SonataFlow Management Console" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals" />
            </div>
          )}

          {activeTab === 'design' && (
            <textarea ref={editorRef} value={design} onChange={(e) => setDesign(e.target.value)} spellCheck={false}
              style={{
                flex: 1, width: '100%', padding: '16px',
                fontFamily: 'var(--pf-global--FontFamily--monospace, "Liberation Mono", consolas, monospace)',
                fontSize: '13px', lineHeight: 1.6, border: 'none', resize: 'none', outline: 'none',
                backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)',
                color: 'var(--pf-global--Color--light-100, #e0e0e0)',
              }} />
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
        <div style={{ width: '240px', display: 'flex', flexDirection: 'column', gap: '0', borderTop: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', borderRight: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', borderBottom: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', borderRadius: '0 6px 6px 0', overflow: 'auto' }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
            <TelemetryOverlay flowId={flowName} />
          </div>

          {/* Resources */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
            <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Resources</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <a href={`/k8s/ns/${NAMESPACE}/pods?labelSelector=platform.io%2Fflow-name%3D${flowName}`}
                style={resourceLinkStyle}>
                <span style={{ color: '#3e8635' }}>{'\u25A3'}</span> Pods
              </a>
              <a href={`/k8s/ns/${NAMESPACE}/tekton.dev~v1~PipelineRun?labelSelector=platform.io%2Fflow-name%3D${flowName}`}
                style={resourceLinkStyle}>
                <span style={{ color: '#f0ab00' }}>{'\u29D7'}</span> PipelineRuns
              </a>
              {flow.status?.argoApplicationName && (
                <a href={`/k8s/ns/openshift-gitops/argoproj.io~v1alpha1~Application/${flow.status.argoApplicationName}`}
                  style={resourceLinkStyle}>
                  <span style={{ color: '#2b9af3' }}>{'\u21BB'}</span> ArgoCD App
                </a>
              )}
              {flow.spec.gitRepository && (
                <a href={flow.spec.gitRepository} target="_blank" rel="noopener noreferrer"
                  style={resourceLinkStyle}>
                  <span style={{ color: '#8476d1' }}>{'\u2197'}</span> Git Repository
                </a>
              )}
              {isSonataFlow && (
                <a href={SONATAFLOW_CONSOLE_URL} target="_blank" rel="noopener noreferrer"
                  style={resourceLinkStyle}>
                  <span style={{ color: '#009596' }}>{'\u29BF'}</span> SonataFlow Console
                </a>
              )}
            </div>
          </div>

          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
            <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Target Clusters</div>
            <div style={{ fontSize: '12px' }}>{(flow.spec.targetClusters || []).join(', ') || 'None'}</div>
          </div>

          {flow.status?.gitCommitHash && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
              <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Last Commit</div>
              <code style={{ fontSize: '12px' }}>{flow.status.gitCommitHash.substring(0, 8)}</code>
            </div>
          )}

          {flow.status?.message && (
            <div style={{ padding: '10px 12px', borderBottom: phase === 'Error' ? '2px solid #c9190b' : undefined }}>
              <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Message</div>
              <div style={{ fontSize: '12px', color: phase === 'Error' ? '#c9190b' : 'inherit' }}>{flow.status.message}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlowDesignerPage;
export { FlowDesignerPage };
