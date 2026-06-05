import * as React from 'react';
import TelemetryOverlay from './TelemetryOverlay';
import FlowVisualizer from './FlowVisualizer';
import type { FlowNode } from './FlowVisualizer';

const API_BASE = '/api/kubernetes/apis/platform.io/v1alpha1';
const PROXY_BASE = '/api/proxy/plugin/openshift-integration-operator/backend';
const NAMESPACE = 'openshift-integration';

interface IntegrationFlow {
  metadata: { name: string; namespace: string };
  spec: {
    engine: string; integrationType?: string; gitRepository: string; branch: string;
    kaotoDesign?: string; targetClusters?: string[];
    desiredState?: string;
    schedule?: string;
    resilience?: { retry?: { maxAttempts?: number; backoff?: string; initialDelay?: string; maxDelay?: string }; circuitBreaker?: { failureThreshold?: number; halfOpenAfter?: string }; maxInflightExchanges?: number };
    alerting?: { errorRateThreshold?: number; enabled?: boolean };
    owner?: string; editors?: string[]; viewers?: string[];
  };
  status?: {
    phase: string; message?: string; gitCommitHash?: string; argoApplicationName?: string;
    currentState?: string; circuitBreakerState?: string; prometheusRuleName?: string;
    sonataFlowName?: string; sonataFlowNamespace?: string; sonataFlowReady?: string;
  };
}

interface DependentFlow { name: string; type: string; phase: string }

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

type TabId = 'visual' | 'kaoto' | 'sonataflow' | 'design' | 'spec' | 'status' | 'history' | 'dependencies';

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
  const [stateChanging, setStateChanging] = React.useState(false);
  const [dependencies, setDependencies] = React.useState<DependentFlow[]>([]);
  const [copiedDesign, setCopiedDesign] = React.useState(false);

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

  const [gitSyncStatus, setGitSyncStatus] = React.useState<string | null>(null);

  const handleSave = async () => {
    if (!flow) return;
    setSaving(true);
    setSaved(false);
    setGitSyncStatus(null);
    try {
      // Update the CR spec
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

      // Also sync to Git via the operator API
      try {
        const gitResp = await fetch(`${PROXY_BASE}/api/flows/${flowName}/design`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
          body: JSON.stringify({ kaotoDesign: design }),
        });
        if (gitResp.ok) {
          const gitData = await gitResp.json();
          setGitSyncStatus(gitData.gitCommitHash
            ? `Synced to Git (${gitData.gitCommitHash.substring(0, 7)})`
            : 'Synced to Git');
        } else {
          setGitSyncStatus('CR saved, Git sync pending (will sync on next reconciliation)');
        }
      } catch {
        setGitSyncStatus('CR saved, Git sync pending');
      }

      setSaved(true);
      setTimeout(() => { setSaved(false); setGitSyncStatus(null); }, 5000);
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

  const changeState = async (desiredState: string) => {
    setStateChanging(true);
    try {
      const resp = await fetch(`${PROXY_BASE}/api/flows/${flowName}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        body: JSON.stringify({ desiredState }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await fetchFlow();
    } catch (e: any) {
      alert(`State change failed: ${e.message}`);
    } finally {
      setStateChanging(false);
    }
  };

  const toggleCircuitBreaker = async () => {
    const action = flow?.status?.circuitBreakerState === 'open' ? 'close' : 'open';
    try {
      await fetch(`${PROXY_BASE}/api/flows/${flowName}/circuit/${action}`, {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfToken() },
      });
      await fetchFlow();
    } catch (e: any) {
      alert(`Circuit breaker: ${e.message}`);
    }
  };

  const fetchDependencies = React.useCallback(async () => {
    try {
      const resp = await fetch(`${PROXY_BASE}/api/flows/${flowName}/dependencies`);
      if (resp.ok) {
        const data = await resp.json();
        setDependencies(data.dependents || []);
      }
    } catch { /* ignore */ }
  }, [flowName]);

  React.useEffect(() => { if (activeTab === 'dependencies') fetchDependencies(); }, [activeTab, fetchDependencies]);

  const copyDesignToClipboard = () => {
    navigator.clipboard.writeText(design).then(() => {
      setCopiedDesign(true);
      setTimeout(() => setCopiedDesign(false), 2000);
    });
  };

  const isSonataFlow = flow?.spec.integrationType === 'SONATAFLOW' || flow?.spec.engine === 'SONATAFLOW';
  const currentState = flow?.status?.currentState || (flow?.status?.phase === 'Running' ? 'running' : flow?.status?.phase === 'Paused' ? 'paused' : 'unknown');
  const circuitState = flow?.status?.circuitBreakerState || 'closed';
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
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {saved && <span style={{ color: '#3e8635', fontSize: '13px' }}>Saved!</span>}
            {gitSyncStatus && <span style={{ color: '#2b9af3', fontSize: '11px' }}>{gitSyncStatus}</span>}
            {/* Lifecycle controls */}
            {phase === 'Running' && (
              <button className="pf-c-button pf-m-warning pf-m-small" onClick={() => changeState('paused')} disabled={stateChanging}
                style={{ fontSize: '12px', padding: '4px 10px' }}>
                {'\u23F8'} Pause
              </button>
            )}
            {(phase === 'Paused' || currentState === 'paused') && (
              <button className="pf-c-button pf-m-secondary pf-m-small" onClick={() => changeState('running')} disabled={stateChanging}
                style={{ fontSize: '12px', padding: '4px 10px' }}>
                {'\u25B6'} Resume
              </button>
            )}
            {phase !== 'Stopped' && (
              <button className="pf-c-button pf-m-danger pf-m-small" onClick={() => { if (confirm('Stop this flow?')) changeState('stopped'); }} disabled={stateChanging}
                style={{ fontSize: '12px', padding: '4px 10px' }}>
                {'\u25A0'} Stop
              </button>
            )}
            {/* Circuit breaker toggle */}
            {circuitState === 'open' && (
              <button className="pf-c-button pf-m-secondary pf-m-small" onClick={toggleCircuitBreaker}
                style={{ fontSize: '12px', padding: '4px 10px', borderColor: '#c9190b', color: '#c9190b' }}>
                {'\u26A1'} Circuit: OPEN - Force Close
              </button>
            )}
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
          <button style={tabStyle(activeTab === 'history')} onClick={() => setActiveTab('history')}>History</button>
          <button style={tabStyle(activeTab === 'dependencies')} onClick={() => setActiveTab('dependencies')}>Dependencies</button>
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
                <button onClick={copyDesignToClipboard}
                  className="pf-c-button pf-m-secondary pf-m-small" style={{ fontSize: '11px', marginLeft: '8px' }}>
                  {copiedDesign ? '\u2713 Copied!' : '\u2398 Copy YAML to Clipboard'}
                </button>
                <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', fontStyle: 'italic' }}>
                  Paste into Kaoto Source tab to sync
                </span>
                <a href={KAOTO_URL} target="_blank" rel="noopener noreferrer"
                  className="pf-c-button pf-m-link pf-m-small" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                  Open in new tab &#x2197;
                </a>
              </div>
              <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <iframe src={KAOTO_URL}
                  style={{ flex: 1, border: 'none', transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
                  title="Kaoto Designer" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals" />
                {/* YAML sync panel */}
                <div style={{ width: '280px', borderLeft: '1px solid var(--pf-global--BorderColor--100, #3c3f42)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)' }}>
                  <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Current kaotoDesign
                    </span>
                  </div>
                  <pre style={{ flex: 1, margin: 0, padding: '8px', overflow: 'auto', fontSize: '11px', lineHeight: 1.5, fontFamily: 'var(--pf-global--FontFamily--monospace, monospace)', color: 'var(--pf-global--Color--light-100, #e0e0e0)' }}>
                    {design || '(empty)'}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sonataflow' && (() => {
            const sfName = flow?.status?.sonataFlowName;
            const sfNs = flow?.status?.sonataFlowNamespace || 'kogito-bpm';
            const sfReady = flow?.status?.sonataFlowReady;
            const sfWorkflowUrl = sfName
              ? `${SONATAFLOW_CONSOLE_URL}/Workflow/${sfName}`
              : SONATAFLOW_CONSOLE_URL;
            return (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '8px 12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)', backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                    SonataFlow Management Console
                  </span>
                  {sfName ? (
                    <>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#009596' }}>{sfName}</span>
                      <span style={{ fontSize: '11px', color: '#6a6e73' }}>in {sfNs}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '3px',
                        backgroundColor: sfReady === 'True' ? '#3e863522' : '#f0ab0022',
                        color: sfReady === 'True' ? '#3e8635' : '#f0ab00',
                      }}>
                        {sfReady === 'True' ? '\u2713 Ready' : '\u29D7 Deploying'}
                      </span>
                      <a href={`/k8s/ns/${sfNs}/sonataflow.org~v1alpha08~SonataFlow/${sfName}`}
                        style={{ fontSize: '11px', color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none' }}>
                        View CR &#x2197;
                      </a>
                    </>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#f0ab00' }}>
                      No SonataFlow CR deployed yet &mdash; save the flow to trigger deployment
                    </span>
                  )}
                  <a href={sfWorkflowUrl} target="_blank" rel="noopener noreferrer"
                    className="pf-c-button pf-m-link pf-m-small" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                    Open in new tab &#x2197;
                  </a>
                </div>
                <iframe src={sfWorkflowUrl}
                  style={{ flex: 1, border: 'none', transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
                  title="SonataFlow Management Console" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals" />
              </div>
            );
          })()}

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

          {activeTab === 'history' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '16px', backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--pf-global--Color--light-100, #e0e0e0)' }}>
                Version History
              </div>
              <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)', marginBottom: '16px' }}>
                Current commit: <code style={{ color: '#79c0ff' }}>{flow.status?.gitCommitHash?.substring(0, 8) || 'none'}</code>
                &nbsp;&middot;&nbsp;Branch: <strong>{flow.spec.branch}</strong>
              </div>
              {flow.spec.gitRepository && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--pf-global--BorderColor--100, #3c3f42)', backgroundColor: 'rgba(47,158,68,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: '#3e8635', fontWeight: 600 }}>{'\u25CF'} Current Version</span>
                        <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', marginTop: '4px' }}>
                          Commit: <code>{flow.status?.gitCommitHash || 'pending'}</code>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '3px', backgroundColor: 'rgba(47,158,68,0.2)', color: '#3e8635', fontWeight: 600 }}>ACTIVE</span>
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px dashed var(--pf-global--BorderColor--100, #3c3f42)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                      {'\u2139'} Full commit history is available from the Git repository. To rollback to a previous version, enter a commit hash:
                    </span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <input className="pf-c-form-control" placeholder="Commit hash..." id="rollback-hash"
                        style={{ flex: 1, fontSize: '12px', fontFamily: 'monospace', backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)', color: '#e0e0e0', border: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }} />
                      <button className="pf-c-button pf-m-warning pf-m-small" style={{ fontSize: '12px' }}
                        onClick={async () => {
                          const hash = (document.getElementById('rollback-hash') as HTMLInputElement)?.value;
                          if (!hash || !confirm(`Rollback ${flowName} to ${hash}?`)) return;
                          try {
                            const resp = await fetch(`${PROXY_BASE}/api/flows/${flowName}/rollback?commitHash=${hash}`, {
                              method: 'POST', headers: { 'X-CSRFToken': getCsrfToken() },
                            });
                            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                            await fetchFlow();
                          } catch (e: any) { alert(`Rollback failed: ${e.message}`); }
                        }}>
                        {'\u21B6'} Rollback
                      </button>
                    </div>
                  </div>
                  <a href={flow.spec.gitRepository} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: 'var(--pf-global--link--Color, #2b9af3)', marginTop: '8px' }}>
                    {'\u2197'} View full history in Git
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dependencies' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '16px', backgroundColor: 'var(--pf-global--BackgroundColor--dark-300, #1b1d21)' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--pf-global--Color--light-100, #e0e0e0)' }}>
                Dependency Graph
              </div>
              <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)', marginBottom: '16px' }}>
                Flows that reference <code style={{ color: '#79c0ff' }}>{flowName}</code> via direct:, kafka:, or seda: endpoints.
              </div>
              {dependencies.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                  <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>{'\u2713'}</span>
                  No flows depend on this one. Safe to modify or delete.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ padding: '8px 12px', borderRadius: '4px', backgroundColor: 'rgba(240,171,0,0.15)', border: '1px solid rgba(240,171,0,0.3)', fontSize: '12px', color: '#f0ab00' }}>
                    {'\u26A0'} {dependencies.length} flow{dependencies.length !== 1 ? 's' : ''} depend{dependencies.length === 1 ? 's' : ''} on this flow. Deleting or modifying may break them.
                  </div>
                  {dependencies.map(dep => (
                    <a key={dep.name} href={`/integration-flows/${dep.name}`}
                      style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--pf-global--BorderColor--100, #3c3f42)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: 'var(--pf-global--link--Color, #2b9af3)', fontWeight: 500, fontSize: '13px' }}>{dep.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', marginLeft: '8px' }}>{dep.type}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: phaseDot[dep.phase] || '#6a6e73', fontWeight: 500 }}>{dep.phase}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
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
              {isSonataFlow && (() => {
                const sfName = flow?.status?.sonataFlowName;
                const sfLink = sfName
                  ? `${SONATAFLOW_CONSOLE_URL}/Workflow/${sfName}`
                  : SONATAFLOW_CONSOLE_URL;
                return (
                  <>
                    <a href={sfLink} target="_blank" rel="noopener noreferrer" style={resourceLinkStyle}>
                      <span style={{ color: '#009596' }}>{'\u29BF'}</span> SonataFlow Console
                    </a>
                    {sfName && (
                      <a href={`/k8s/ns/${flow?.status?.sonataFlowNamespace || 'kogito-bpm'}/sonataflow.org~v1alpha08~SonataFlow/${sfName}`}
                        style={resourceLinkStyle}>
                        <span style={{ color: '#009596' }}>{'\u2699'}</span> SonataFlow CR
                      </a>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
            <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Target Clusters</div>
            <div style={{ fontSize: '12px' }}>{(flow.spec.targetClusters || []).join(', ') || 'None'}</div>
          </div>

          {/* Lifecycle State */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
            <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>State</div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
                backgroundColor: currentState === 'running' ? '#3e8635' : currentState === 'paused' ? '#f0ab00' : '#c9190b' }} />
              {currentState}
            </div>
          </div>

          {/* Circuit Breaker */}
          {flow.spec.resilience?.circuitBreaker && (
            <div style={{ padding: '10px 12px', borderBottom: circuitState === 'open' ? '2px solid #c9190b' : '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
              <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Circuit Breaker</div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '12px',
                color: circuitState === 'open' ? '#c9190b' : circuitState === 'half-open' ? '#f0ab00' : '#3e8635' }}>
                {circuitState === 'open' ? '\u26A0' : circuitState === 'half-open' ? '\u29D7' : '\u2713'} {circuitState}
              </div>
            </div>
          )}

          {/* Schedule */}
          {flow.spec.schedule && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
              <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Schedule</div>
              <code style={{ fontSize: '11px' }}>{flow.spec.schedule}</code>
            </div>
          )}

          {/* Resilience Config */}
          {flow.spec.resilience?.retry && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
              <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Retry Policy</div>
              <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                {flow.spec.resilience.retry.maxAttempts || 3}x {flow.spec.resilience.retry.backoff || 'exponential'}
              </div>
            </div>
          )}

          {flow.status?.gitCommitHash && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
              <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Last Commit</div>
              <code style={{ fontSize: '12px' }}>{flow.status.gitCommitHash.substring(0, 8)}</code>
            </div>
          )}

          {/* Alerting */}
          {flow.spec.alerting?.enabled && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
              <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Alerting</div>
              <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                Error rate &gt; {((flow.spec.alerting.errorRateThreshold || 0.05) * 100).toFixed(0)}%
              </div>
              {flow.status?.prometheusRuleName && (
                <code style={{ fontSize: '10px' }}>{flow.status.prometheusRuleName}</code>
              )}
            </div>
          )}

          {/* Owner */}
          {flow.spec.owner && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
              <div className="co-help-text" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Owner</div>
              <div style={{ fontSize: '12px' }}>{flow.spec.owner}</div>
              {flow.spec.editors?.length ? <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Editors: {flow.spec.editors.join(', ')}</div> : null}
              {flow.spec.viewers?.length ? <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Viewers: {flow.spec.viewers.join(', ')}</div> : null}
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
