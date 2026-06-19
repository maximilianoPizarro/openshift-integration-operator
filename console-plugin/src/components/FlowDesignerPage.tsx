import '../theme/tokens.css';
import '../theme/flow-designer.css';
import * as React from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Label,
  PageSection,
  Spinner,
  Tab,
  Tabs,
  TabTitleText,
  TextInput,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import TelemetryOverlay from './TelemetryOverlay';
import FlowVisualizer from './FlowVisualizer';
import { formatTargetClusters } from '../utils/targeting';
import type { FlowNode } from './FlowVisualizer';
import EphemeralBanner from './ephemeral/EphemeralBanner';
import EphemeralBadge from './ephemeral/EphemeralBadge';
import ExtendTtlModal from './ephemeral/ExtendTtlModal';
import PromoteToGitOpsModal from './ephemeral/PromoteToGitOpsModal';
import FlowLogsTab from './FlowLogsTab';
import ConfirmLifecycleModal from './modals/ConfirmLifecycleModal';
import { API_BASE, PLATFORM_NAMESPACE, PROXY_BASE } from '../constants';
import { buildPodLinks } from '../utils/podLinks';
import { flowApiPath, integrationFlowUrl, consoleFlowUrl } from '../utils/k8sUrls';

interface PlatformConfig {
  kaotoUrl?: string;
  kaotoRouteHost?: string;
  sonataFlowConsoleUrl?: string;
  sonataFlowConsoleRouteHost?: string;
  sonataFlowEnabled?: boolean;
  gitProvider?: string;
  tektonEnabled?: boolean;
}

interface IntegrationFlow {
  metadata: { name: string; namespace: string };
  spec: {
    engine: string; integrationType?: string; gitRepository: string; branch: string;
    kaotoDesign?: string; targetClusters?: string[];
    targeting?: { strategy?: string; clusters?: string[] };
    desiredState?: string;
    schedule?: string;
    resilience?: { retry?: { maxAttempts?: number; backoff?: string; initialDelay?: string; maxDelay?: string }; circuitBreaker?: { failureThreshold?: number; halfOpenAfter?: string }; maxInflightExchanges?: number };
    alerting?: { errorRateThreshold?: number; enabled?: boolean };
    owner?: string; editors?: string[]; viewers?: string[];
    deploymentMode?: string;
    ephemeral?: { ttlSeconds?: number; properties?: Record<string, string>; disableProperties?: string[] };
    secrets?: Array<{ name: string; mountPath?: string; envFrom?: boolean; subPath?: string }>;
  };
  status?: {
    phase: string; message?: string; gitCommitHash?: string; argoApplicationName?: string;
    currentState?: string; circuitBreakerState?: string; prometheusRuleName?: string;
    sonataFlowName?: string; sonataFlowNamespace?: string; sonataFlowReady?: string;
    deploymentMode?: string; ephemeralExpiresAt?: string; ephemeralWorkerRef?: string;
  };
}

interface DependentFlow { name: string; type: string; phase: string }

function getCsrfToken(): string {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : '';
}

function extractRouteParams(): { namespace: string; name: string } {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);
  const idx = segments.indexOf('integration-flows');
  if (idx >= 0 && segments[idx + 1] === 'ns' && idx + 3 <= segments.length) {
    return {
      namespace: decodeURIComponent(segments[idx + 2] || PLATFORM_NAMESPACE),
      name: decodeURIComponent(segments[idx + 3] || ''),
    };
  }
  if (idx >= 0 && idx + 1 < segments.length) {
    return { namespace: PLATFORM_NAMESPACE, name: segments[idx + 1] };
  }
  return { namespace: PLATFORM_NAMESPACE, name: '' };
}

interface FlowDesignerPageProps {
  match?: { params: { name?: string; namespace?: string } };
}

const phaseDot: Record<string, string> = {
  Running: '#3e8635', Building: '#f0ab00', Scaffolding: '#8476d1',
  Deploying: '#0066cc', PartiallyHealthy: '#f0ab00', Error: '#c9190b',
};

type LabelColor = 'blue' | 'teal' | 'green' | 'orange' | 'purple' | 'red' | 'grey' | 'yellow';

const phaseToLabelColor: Record<string, LabelColor> = {
  Running: 'green',
  Building: 'yellow',
  Scaffolding: 'purple',
  Deploying: 'blue',
  PartiallyHealthy: 'orange',
  Error: 'red',
  Pending: 'grey',
  Paused: 'orange',
  Stopped: 'grey',
  Expired: 'red',
};

function getBaseAppsDomain(): string {
  const host = window.location.hostname;
  const parts = host.split('.');
  const appsIdx = parts.indexOf('apps');
  if (appsIdx > 0) return parts.slice(appsIdx).join('.');
  return 'apps.cluster.local';
}

function resolveKaotoUrl(config: PlatformConfig | null): string {
  if (config?.kaotoUrl) return config.kaotoUrl;
  const host = config?.kaotoRouteHost || `kaoto-${PLATFORM_NAMESPACE}`;
  return `https://${host}.${getBaseAppsDomain()}`;
}

function resolveSonataFlowConsoleUrl(config: PlatformConfig | null): string {
  if (config?.sonataFlowConsoleUrl) return config.sonataFlowConsoleUrl;
  const host = config?.sonataFlowConsoleRouteHost || 'sonataflow-management-console-kogito-bpm';
  return `https://${host}.${getBaseAppsDomain()}`;
}

type TabId = 'visual' | 'kaoto' | 'sonataflow' | 'design' | 'spec' | 'cr-status' | 'history' | 'dependencies' | 'logs';

function initialTabFromUrl(): TabId {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab === 'logs') return 'logs';
  if (tab === 'cr-status' || tab === 'status') return 'cr-status';
  if (tab === 'spec') return 'spec';
  if (tab === 'history') return 'history';
  if (tab === 'dependencies') return 'dependencies';
  if (tab === 'design') return 'design';
  if (tab === 'kaoto') return 'kaoto';
  if (tab === 'sonataflow') return 'sonataflow';
  return 'visual';
}

function syncTabToUrl(tab: TabId) {
  const url = new URL(window.location.href);
  if (tab === 'visual') {
    url.searchParams.delete('tab');
  } else {
    url.searchParams.set('tab', tab);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

const FlowDesignerPage: React.FC<FlowDesignerPageProps> = ({ match }) => {
  const routeParams = extractRouteParams();
  const flowNamespace = match?.params?.namespace || routeParams.namespace;
  const flowName = match?.params?.name || routeParams.name;
  const [flow, setFlow] = React.useState<IntegrationFlow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [design, setDesign] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabId>(initialTabFromUrl());
  const [platformConfig, setPlatformConfig] = React.useState<PlatformConfig | null>(null);
  const [lifecycleModal, setLifecycleModal] = React.useState<'pause' | 'stop' | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [sidebarInFullscreen, setSidebarInFullscreen] = React.useState(false);
  const [sidebarVisible, setSidebarVisible] = React.useState(true);
  const [kaotoPreviewVisible, setKaotoPreviewVisible] = React.useState(false);
  const [compactLayout, setCompactLayout] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth < 1500 : false,
  );
  const contentRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<HTMLTextAreaElement>(null);
  const [selectedYamlRange, setSelectedYamlRange] = React.useState<{ start: number; end: number } | null>(null);
  const [stateChanging, setStateChanging] = React.useState(false);
  const [dependencies, setDependencies] = React.useState<DependentFlow[]>([]);
  const [copiedDesign, setCopiedDesign] = React.useState(false);
  const [copiedFull, setCopiedFull] = React.useState(false);
  const [showExtendModal, setShowExtendModal] = React.useState(false);
  const [showPromoteModal, setShowPromoteModal] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastRefreshed, setLastRefreshed] = React.useState('');

  const kaotoUrl = resolveKaotoUrl(platformConfig);
  const sonataFlowConsoleUrl = resolveSonataFlowConsoleUrl(platformConfig);

  React.useEffect(() => {
    fetch(`${PROXY_BASE}/api/config`)
      .then(r => r.ok ? r.json() : null)
      .then(cfg => { if (cfg) setPlatformConfig(cfg); })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    const onFullscreenChange = () => {
      const isFs = document.fullscreenElement === contentRef.current;
      setFullscreen(isFs);
      if (!isFs) setSidebarInFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  React.useEffect(() => {
    const onResize = () => setCompactLayout(window.innerWidth < 1500);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  React.useEffect(() => {
    if (activeTab === 'kaoto') {
      setSidebarVisible(false);
      if (compactLayout) {
        setKaotoPreviewVisible(false);
      }
    }
  }, [activeTab, compactLayout]);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);

  const fetchFlow = React.useCallback(async (manual = false) => {
    if (!flowName) { setError('No flow name'); setLoading(false); return; }
    if (manual) setRefreshing(true);
    try {
      const resp = await fetch(integrationFlowUrl(flowNamespace, flowName));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: IntegrationFlow = await resp.json();
      setFlow(data);
      setDesign(prev => prev || data.spec.kaotoDesign || '');
      setError(null);
      if (manual) setLastRefreshed(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [flowName, flowNamespace]);

  React.useEffect(() => {
    setLoading(true);
    fetchFlow();
  }, [fetchFlow]);

  const [gitSyncStatus, setGitSyncStatus] = React.useState<string | null>(null);

  const handleSave = async () => {
    if (!flow) return;
    setSaving(true);
    setSaved(false);
    setGitSyncStatus(null);
    try {
      const patch = [{ op: 'replace', path: '/spec/kaotoDesign', value: design }];
      const resp = await fetch(integrationFlowUrl(flowNamespace, flowName), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json', 'X-CSRFToken': getCsrfToken() },
        body: JSON.stringify(patch),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${resp.status}`);
      }

      const isEphemeralFlow = flow.spec.deploymentMode === 'EPHEMERAL';
      if (!isEphemeralFlow) {
        try {
          const gitResp = await fetch(`${PROXY_BASE}${flowApiPath(flowNamespace, flowName, '/design')}`, {
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
      } else {
        setGitSyncStatus('Design saved; ephemeral runtime will reconcile');
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
      const resp = await fetch(`${PROXY_BASE}${flowApiPath(flowNamespace, flowName, '/state')}`, {
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
      await fetch(`${PROXY_BASE}${flowApiPath(flowNamespace, flowName, `/circuit/${action}`)}`, {
        method: 'POST', headers: { 'X-CSRFToken': getCsrfToken() },
      });
      await fetchFlow();
    } catch (e: any) {
      alert(`Circuit breaker: ${e.message}`);
    }
  };

  const fetchDependencies = React.useCallback(async () => {
    try {
      const resp = await fetch(`${PROXY_BASE}${flowApiPath(flowNamespace, flowName, '/dependencies')}`);
      if (resp.ok) {
        const data = await resp.json();
        setDependencies(data.dependents || []);
      }
    } catch { /* ignore */ }
  }, [flowName, flowNamespace]);

  React.useEffect(() => { if (activeTab === 'dependencies') fetchDependencies(); }, [activeTab, fetchDependencies]);

  const copyDesignToClipboard = () => {
    navigator.clipboard.writeText(design).then(() => {
      setCopiedDesign(true);
      setTimeout(() => setCopiedDesign(false), 2000);
    });
  };

  const copyFullYamlToClipboard = () => {
    if (!flow) return;
    const fullYaml = `apiVersion: platform.io/v1alpha1\nkind: IntegrationFlow\nmetadata:\n  name: ${flow.metadata.name}\n  namespace: ${flow.metadata.namespace}\nspec:\n  engine: ${flow.spec.engine || 'CAMEL'}\n  integrationType: ${flow.spec.integrationType || 'CAMEL_ROUTE'}\n${flow.spec.deploymentMode ? '  deploymentMode: ' + flow.spec.deploymentMode + '\n' : ''}${flow.spec.gitRepository ? '  gitRepository: ' + flow.spec.gitRepository + '\n' : ''}${flow.spec.branch ? '  branch: ' + flow.spec.branch + '\n' : ''}  kaotoDesign: |\n${design.split('\n').map(l => '    ' + l).join('\n')}\n`;
    navigator.clipboard.writeText(fullYaml).then(() => {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2000);
    });
  };

  const isSonataFlow = flow?.spec.integrationType === 'SONATAFLOW' || flow?.spec.engine === 'SONATAFLOW';
  const isEphemeral = flow?.spec.deploymentMode === 'EPHEMERAL' || flow?.status?.deploymentMode === 'EPHEMERAL';
  const currentState = flow?.status?.currentState || (flow?.status?.phase === 'Running' ? 'running' : flow?.status?.phase === 'Paused' ? 'paused' : 'unknown');
  const circuitState = flow?.status?.circuitBreakerState || 'closed';
  const phase = flow?.status?.phase || 'Pending';

  const designLines = flow ? design.split('\n') : [];
  const tabFillHeight = fullscreen ? 'calc(100vh - 88px)' : 'calc(100vh - 260px)';
  const showSidebarPanel = fullscreen ? sidebarInFullscreen : (activeTab === 'kaoto' ? sidebarVisible : true);
  const showKaotoPreview = kaotoPreviewVisible && !compactLayout;

  const toggleFullscreen = () => {
    if (!fullscreen && contentRef.current) {
      contentRef.current.requestFullscreen?.().catch(() => setFullscreen(false));
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const renderZoomToolbar = () => (
    <Toolbar style={{ padding: '0 8px', minHeight: 'auto' }}>
      <ToolbarContent style={{ padding: 0 }}>
        <ToolbarItem style={{ marginLeft: 'auto' }}>
          {!fullscreen && activeTab === 'kaoto' && (
            <>
              <Button
                variant="plain"
                onClick={() => setSidebarVisible(v => !v)}
                title="Toggle details panel"
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                {sidebarVisible ? 'Hide details' : 'Details'}
              </Button>
              <Button
                variant="plain"
                onClick={() => setKaotoPreviewVisible(v => !v)}
                title="Toggle kaotoDesign preview"
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                {showKaotoPreview ? 'Hide preview' : 'Preview'}
              </Button>
            </>
          )}
          {fullscreen && (
            <Button variant="plain" onClick={() => setSidebarInFullscreen(v => !v)} title="Toggle sidebar panel" style={{ padding: '4px 8px', fontSize: '11px' }}>
              {sidebarInFullscreen ? 'Hide panel' : 'Panel'}
            </Button>
          )}
          <Button variant="plain" onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} title="Zoom Out" style={{ padding: '4px 8px' }}>{'\u2212'}</Button>
          <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center', color: 'var(--pf-global--Color--200, #6a6e73)', display: 'inline-block' }}>{Math.round(zoom * 100)}%</span>
          <Button variant="plain" onClick={() => setZoom(z => Math.min(3, z + 0.1))} title="Zoom In" style={{ padding: '4px 8px' }}>+</Button>
          <Button variant="plain" onClick={() => setZoom(1)} title="Reset Zoom" style={{ padding: '4px 8px', fontSize: '12px' }}>1:1</Button>
          <Button variant="plain" title={fullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'} onClick={toggleFullscreen} style={{ padding: '4px 8px' }}>
            {fullscreen ? '\u2716' : '\u26F6'}
          </Button>
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  );

  if (loading) return (
    <PageSection style={{ padding: '24px' }}>
      <Spinner size="lg" aria-label="Loading flow" />
    </PageSection>
  );

  if (error || !flow) return (
    <PageSection style={{ padding: '24px' }}>
      <Alert variant="danger" isInline title={`Error loading flow "${flowName}": ${error}`} style={{ marginBottom: '16px' }} />
      <Button variant="link" component="a" href="/integration-flows">&larr; Back to Flows</Button>
    </PageSection>
  );

  return (
    <PageSection padding={{ default: 'padding' }} style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <Button variant="link" component="a" href="/integration-flows" isInline style={{ padding: 0, marginBottom: '6px', display: 'inline-block' }}>
          &larr; Back to Flows
        </Button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title headingLevel="h1" size="lg" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {flow.metadata.name}
              <Label color={phaseToLabelColor[phase] || 'grey'}>{phase}</Label>
              <EphemeralBadge
                deploymentMode={flow.spec.deploymentMode || flow.status?.deploymentMode}
                ephemeralExpiresAt={flow.status?.ephemeralExpiresAt}
              />
            </Title>
            <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
              Engine: <strong>{flow.spec.integrationType || flow.spec.engine}</strong>
              {!isEphemeral && <> &middot; Branch: <strong>{flow.spec.branch}</strong></>}
              {formatTargetClusters(flow.spec) !== 'None' ? <> &middot; Clusters: <strong>{formatTargetClusters(flow.spec)}</strong></> : null}
              {lastRefreshed ? <> &middot; Updated {lastRefreshed}</> : null}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Button variant="secondary" onClick={() => fetchFlow(true)} isDisabled={refreshing || stateChanging}>
              {refreshing ? 'Refreshing…' : '\u21BB Refresh'}
            </Button>
            {saved && <span style={{ color: '#3e8635', fontSize: '13px' }}>Saved!</span>}
            {gitSyncStatus && <span style={{ color: '#2b9af3', fontSize: '11px' }}>{gitSyncStatus}</span>}
            {phase === 'Running' && (
              <Button variant="warning" onClick={() => setLifecycleModal('pause')} isDisabled={stateChanging}>
                {'\u23F8'} Pause
              </Button>
            )}
            {(phase === 'Paused' || currentState === 'paused') && (
              <Button variant="secondary" onClick={() => changeState('running')} isDisabled={stateChanging}>
                {'\u25B6'} Resume
              </Button>
            )}
            {phase !== 'Stopped' && (
              <Button variant="danger" onClick={() => setLifecycleModal('stop')} isDisabled={stateChanging}>
                {'\u25A0'} Stop
              </Button>
            )}
            {circuitState === 'open' && (
              <Button variant="secondary" isDanger onClick={toggleCircuitBreaker}>
                {'\u26A1'} Circuit: OPEN - Force Close
              </Button>
            )}
            {isEphemeral && phase !== 'Expired' && (
              <>
                <Button variant="secondary" onClick={() => setShowExtendModal(true)}>
                  Extend TTL
                </Button>
                <Button variant="secondary" onClick={() => setShowPromoteModal(true)}>
                  Promote to GitOps
                </Button>
              </>
            )}
            <Button variant="primary" onClick={handleSave} isDisabled={saving}>
              {saving ? 'Saving...' : 'Save Design'}
            </Button>
          </div>
        </div>
        {isEphemeral && !bannerDismissed && (
          <div style={{ marginTop: '12px' }}>
            <EphemeralBanner
              expiresAt={flow.status?.ephemeralExpiresAt}
              onDismiss={() => setBannerDismissed(true)}
            />
          </div>
        )}
      </div>

      <ExtendTtlModal
        flowNamespace={flowNamespace}
        flowName={flowName}
        isOpen={showExtendModal}
        onClose={() => setShowExtendModal(false)}
        onExtended={fetchFlow}
      />
      <PromoteToGitOpsModal
        flowNamespace={flowNamespace}
        flowName={flowName}
        isOpen={showPromoteModal}
        onClose={() => setShowPromoteModal(false)}
        onPromoted={fetchFlow}
      />
      <ConfirmLifecycleModal
        isOpen={lifecycleModal !== null}
        action={lifecycleModal || 'pause'}
        flowName={flowName}
        onClose={() => setLifecycleModal(null)}
        onConfirm={() => {
          if (lifecycleModal === 'pause') changeState('paused');
          if (lifecycleModal === 'stop') changeState('stopped');
          setLifecycleModal(null);
        }}
        loading={stateChanging}
      />

      {/* Tabs + Content + Sidebar */}
      <div
        ref={contentRef}
        className={`${fullscreen ? 'integration-workspace--fullscreen' : ''}${sidebarInFullscreen ? ' integration-workspace--sidebar-visible' : ''}${compactLayout ? ' integration-workspace--compact' : ''}`}
        style={{ flex: 1, display: 'flex', minHeight: 0, backgroundColor: fullscreen ? 'var(--pf-global--BackgroundColor--dark-300, #151515)' : undefined }}
      >
        {/* Main area with Tabs */}
        <div className="integration-workspace__main" style={{ flex: 3, display: 'flex', flexDirection: 'column', border: '1px solid var(--integration-border)', borderRadius: '6px 0 0 6px', overflow: 'hidden' }}>
          {fullscreen && (
            <div style={{ padding: '4px 12px', display: 'flex', justifyContent: 'flex-end', gap: '4px', borderBottom: '1px solid var(--integration-border)', flexShrink: 0 }}>
              <Button variant="plain" onClick={() => setSidebarInFullscreen(v => !v)} style={{ fontSize: '11px' }}>
                {sidebarInFullscreen ? 'Hide panel' : 'Show panel'}
              </Button>
              <Button variant="plain" onClick={toggleFullscreen} style={{ fontSize: '11px' }}>
                Exit fullscreen (Esc)
              </Button>
            </div>
          )}
          <Tabs
            activeKey={activeTab}
            onSelect={(event, eventKey) => {
              event?.preventDefault?.();
              const tab = eventKey as TabId;
              setActiveTab(tab);
              syncTabToUrl(tab);
            }}
            mountOnEnter
          >
            <Tab eventKey="visual" title={<TabTitleText>Visual Flow</TabTitleText>}>
              <div style={{ display: 'flex', flexDirection: 'column', height: tabFillHeight }} data-integration-tab-fill>
                {renderZoomToolbar()}
                <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                  <div style={{ flex: 1, backgroundColor: 'var(--integration-bg-dark)', overflow: 'auto' }}>
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                      <FlowVisualizer design={design} engine={flow.spec.engine} onNodeClick={handleNodeClick} />
                    </div>
                  </div>
                {selectedYamlRange && (
                  <div style={{ width: '340px', borderLeft: '1px solid var(--integration-border)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--integration-bg-dark)' }}>
                    <div style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--integration-border)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', fontWeight: 600, textTransform: 'uppercase' }}>
                        YAML &middot; Lines {selectedYamlRange.start + 1}&ndash;{selectedYamlRange.end + 1}
                      </span>
                      <Button variant="plain" onClick={() => setSelectedYamlRange(null)} style={{ padding: '2px 4px', fontSize: '12px' }}>{'\u2716'}</Button>
                    </div>
                    <pre style={{ flex: 1, margin: 0, padding: '8px', overflow: 'auto', fontSize: '12px', lineHeight: 1.6, fontFamily: 'var(--pf-global--FontFamily--monospace, monospace)', color: 'var(--integration-text-primary)' }}>
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
              </div>
            </Tab>

            {!isSonataFlow && (
              <Tab eventKey="kaoto" title={<TabTitleText>Kaoto Designer</TabTitleText>}>
                <div style={{ display: 'flex', flexDirection: 'column', height: tabFillHeight }} data-integration-tab-fill>
                  <div style={{ padding: '6px 10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--integration-border)', backgroundColor: 'var(--integration-bg-dark)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                      Kaoto Designer &mdash; <strong>{flowName}</strong>
                    </span>
                    <Button variant="secondary" onClick={copyDesignToClipboard} style={{ fontSize: '11px', marginLeft: '8px' }}>
                      {copiedDesign ? '\u2713 Copied!' : '\u2398 Copy YAML to Clipboard'}
                    </Button>
                    <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', fontStyle: 'italic' }}>
                      Paste into Kaoto Source tab to sync
                    </span>
                    {compactLayout && (
                      <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                        Compact layout active
                      </span>
                    )}
                    <Button variant="link" component="a" href={kaotoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                      Open in new tab &#x2197;
                    </Button>
                  </div>
                  {renderZoomToolbar()}
                  <div className="integration-kaoto-canvas" style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
                    <iframe src={kaotoUrl}
                      style={{ flex: 1, border: 'none', minWidth: 0, transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
                      title="Kaoto Designer" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals" />
                    {showKaotoPreview && (
                    <div className="integration-kaoto-preview" style={{ width: '280px', borderLeft: '1px solid var(--integration-border)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--integration-bg-dark)' }}>
                      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--integration-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', fontWeight: 600, textTransform: 'uppercase' }}>
                          Current kaotoDesign
                        </span>
                      </div>
                      <pre style={{ flex: 1, margin: 0, padding: '8px', overflow: 'auto', fontSize: '11px', lineHeight: 1.5, fontFamily: 'var(--pf-global--FontFamily--monospace, monospace)', color: 'var(--integration-text-primary)' }}>
                        {design || '(empty)'}
                      </pre>
                    </div>
                    )}
                  </div>
                </div>
              </Tab>
            )}

            {isSonataFlow && (
              <Tab eventKey="sonataflow" title={<TabTitleText>SonataFlow Console</TabTitleText>}>
                {(() => {
                  const sfName = flow?.status?.sonataFlowName;
                  const sfNs = flow?.status?.sonataFlowNamespace || 'kogito-bpm';
                  const sfReady = flow?.status?.sonataFlowReady;
                  const sfWorkflowUrl = sfName
                    ? `${sonataFlowConsoleUrl}/Workflow/${sfName}`
                    : sonataFlowConsoleUrl;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', height: tabFillHeight }} data-integration-tab-fill>
                      <div style={{ padding: '8px 12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--integration-border)', backgroundColor: 'var(--integration-bg-dark)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                          SonataFlow Management Console
                        </span>
                        {sfName ? (
                          <>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#009596' }}>{sfName}</span>
                            <span style={{ fontSize: '11px', color: '#6a6e73' }}>in {sfNs}</span>
                            <Label color={sfReady === 'True' ? 'green' : 'yellow'} isCompact>
                              {sfReady === 'True' ? '\u2713 Ready' : '\u29D7 Deploying'}
                            </Label>
                            <Button variant="link" isInline component="a"
                              href={`/k8s/ns/${sfNs}/sonataflow.org~v1alpha08~SonataFlow/${sfName}`}
                              style={{ fontSize: '11px' }}>
                              View CR &#x2197;
                            </Button>
                          </>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#f0ab00' }}>
                            No SonataFlow CR deployed yet &mdash; save the flow to trigger deployment
                          </span>
                        )}
                        <Button variant="link" component="a" href={sfWorkflowUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                          Open in new tab &#x2197;
                        </Button>
                      </div>
                      {renderZoomToolbar()}
                      <iframe src={sfWorkflowUrl}
                        style={{ flex: 1, border: 'none', transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
                        title="SonataFlow Management Console" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals" />
                    </div>
                  );
                })()}
              </Tab>
            )}

            <Tab eventKey="design" title={<TabTitleText>YAML Editor</TabTitleText>}>
              <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--integration-border)', backgroundColor: 'var(--integration-bg-dark)', alignItems: 'center' }}>
                <Button variant="secondary" onClick={copyDesignToClipboard} style={{ fontSize: '11px' }}>
                  {copiedDesign ? '\u2713 Copied!' : '\u2398 Copy kaotoDesign'}
                </Button>
                <Button variant="secondary" onClick={copyFullYamlToClipboard} style={{ fontSize: '11px' }}>
                  {copiedFull ? '\u2713 Copied!' : '\u2398 Copy Full CR YAML'}
                </Button>
                <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', marginLeft: 'auto' }}>
                  {design.split('\n').length} lines
                </span>
              </div>
              <textarea ref={editorRef} value={design} onChange={(e) => setDesign(e.target.value)} spellCheck={false}
                data-integration-tab-fill
                style={{
                  width: '100%', height: tabFillHeight, padding: '16px',
                  fontFamily: 'var(--pf-global--FontFamily--monospace, "Liberation Mono", consolas, monospace)',
                  fontSize: '13px', lineHeight: 1.6, border: 'none', resize: 'none', outline: 'none',
                  backgroundColor: 'var(--integration-bg-dark)',
                  color: 'var(--integration-text-primary)',
                }} />
            </Tab>

            <Tab eventKey="history" title={<TabTitleText>History</TabTitleText>}>
              <div style={{ padding: '16px', backgroundColor: 'var(--integration-bg-dark)', minHeight: '300px' }}>
                <Title headingLevel="h3" size="md" style={{ marginBottom: '12px', color: 'var(--integration-text-primary)' }}>
                  Version History
                </Title>
                <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)', marginBottom: '16px' }}>
                  Current commit: <code style={{ color: '#79c0ff' }}>{flow.status?.gitCommitHash?.substring(0, 8) || 'none'}</code>
                  &nbsp;&middot;&nbsp;Branch: <strong>{flow.spec.branch}</strong>
                </div>
                {flow.spec.gitRepository && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--integration-border)', backgroundColor: 'rgba(47,158,68,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: '#3e8635', fontWeight: 600 }}>{'\u25CF'} Current Version</span>
                          <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', marginTop: '4px' }}>
                            Commit: <code>{flow.status?.gitCommitHash || 'pending'}</code>
                          </div>
                        </div>
                        <Label color="green" isCompact>ACTIVE</Label>
                      </div>
                    </div>
                    <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px dashed var(--integration-border)' }}>
                      <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                        {'\u2139'} Full commit history is available from the Git repository. To rollback to a previous version, enter a commit hash:
                      </span>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <TextInput
                          placeholder="Commit hash..."
                          aria-label="Rollback commit hash"
                          id="rollback-hash"
                          style={{ flex: 1, fontSize: '12px', fontFamily: 'monospace', backgroundColor: 'var(--integration-bg-dark)', color: 'var(--integration-text-primary)', border: '1px solid var(--integration-border)' }}
                        />
                        <Button variant="warning" style={{ fontSize: '12px' }}
                          onClick={async () => {
                            const hash = (document.getElementById('rollback-hash') as HTMLInputElement)?.value;
                            if (!hash || !confirm(`Rollback ${flowName} to ${hash}?`)) return;
                            try {
                              const resp = await fetch(`${PROXY_BASE}${flowApiPath(flowNamespace, flowName, '/rollback')}?commitHash=${hash}`, {
                                method: 'POST', headers: { 'X-CSRFToken': getCsrfToken() },
                              });
                              if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                              await fetchFlow();
                            } catch (e: any) { alert(`Rollback failed: ${e.message}`); }
                          }}>
                          {'\u21B6'} Rollback
                        </Button>
                      </div>
                    </div>
                    <a href={flow.spec.gitRepository} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '12px', color: 'var(--pf-global--link--Color, #2b9af3)', marginTop: '8px' }}>
                      {'\u2197'} View full history in Git
                    </a>
                  </div>
                )}
              </div>
            </Tab>

            <Tab eventKey="dependencies" title={<TabTitleText>Dependencies</TabTitleText>}>
              <div style={{ padding: '16px', backgroundColor: 'var(--integration-bg-dark)', minHeight: '300px' }}>
                <Title headingLevel="h3" size="md" style={{ marginBottom: '8px', color: 'var(--integration-text-primary)' }}>
                  Dependency Graph
                </Title>
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
                    <Alert variant="warning" isInline title={`${dependencies.length} flow${dependencies.length !== 1 ? 's' : ''} depend${dependencies.length === 1 ? 's' : ''} on this flow. Deleting or modifying may break them.`} />
                    {dependencies.map(dep => (
                      <a key={dep.name} href={`/integration-flows/${dep.name}`}
                        style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--integration-border)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ color: 'var(--pf-global--link--Color, #2b9af3)', fontWeight: 500, fontSize: '13px' }}>{dep.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', marginLeft: '8px' }}>{dep.type}</span>
                        </div>
                        <Label color={phaseToLabelColor[dep.phase] || 'grey'} isCompact>{dep.phase}</Label>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </Tab>

            <Tab eventKey="spec" title={<TabTitleText>Spec</TabTitleText>}>
              <div style={{ display: 'flex', minHeight: '300px' }}>
                <pre style={{
                  flex: 1, margin: 0, padding: '16px', overflow: 'auto',
                  fontFamily: 'var(--pf-global--FontFamily--monospace, "Liberation Mono", consolas, monospace)',
                  fontSize: '13px', lineHeight: 1.6,
                  backgroundColor: 'var(--integration-bg-dark)',
                  color: 'var(--integration-text-primary)',
                }}>{JSON.stringify(flow.spec, null, 2)}</pre>
                {isEphemeral && (
                  <div style={{
                    width: '320px', borderLeft: '1px solid var(--integration-border)',
                    padding: '16px', overflow: 'auto',
                    backgroundColor: 'var(--integration-bg-dark)',
                    color: 'var(--integration-text-primary)',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#2b9af3' }}>
                      {'\u2699'} Ephemeral Properties Guide
                    </div>
                    <div style={{ fontSize: '11px', lineHeight: 1.6, color: 'var(--pf-global--Color--200, #6a6e73)', marginBottom: '12px' }}>
                      Configure <code>spec.ephemeral.properties</code> in the CR to inject
                      <code> application.properties</code> into the worker. Properties are auto-detected
                      from Camel components (Kafka, SQL, FHIR, etc.) and merged with your overrides.
                    </div>

                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Add properties via CR:</div>
                    <pre style={{
                      fontSize: '10px', lineHeight: 1.5, padding: '8px', borderRadius: '4px',
                      backgroundColor: 'rgba(0,0,0,0.3)', color: '#79c0ff', marginBottom: '12px',
                      fontFamily: 'monospace', overflow: 'auto',
                    }}>{`spec:
  ephemeral:
    properties:
      camel.component.kafka.brokers: "kafka:9092"
      quarkus.datasource.jdbc.url: "jdbc:postgresql://db:5432/mydb"
    disableProperties:
      - "quarkus.infinispan-client.*"`}</pre>

                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Mount secrets:</div>
                    <pre style={{
                      fontSize: '10px', lineHeight: 1.5, padding: '8px', borderRadius: '4px',
                      backgroundColor: 'rgba(0,0,0,0.3)', color: '#79c0ff', marginBottom: '12px',
                      fontFamily: 'monospace', overflow: 'auto',
                    }}>{`spec:
  secrets:
    - name: my-db-credentials
      envFrom: true
    - name: my-tls-cert
      mountPath: /etc/certs`}</pre>

                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Auto-detected components:</div>
                    <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', lineHeight: 1.6 }}>
                      <div><code>kafka</code> {'\u2192'} broker URL</div>
                      <div><code>sql</code>, <code>jdbc</code> {'\u2192'} datasource config</div>
                      <div><code>mongodb</code> {'\u2192'} host/port</div>
                      <div><code>fhir</code> {'\u2192'} FHIR server URL</div>
                      <div><code>aws2-s3</code>, <code>aws2-sqs</code> {'\u2192'} region</div>
                      <div><code>amqp</code>, <code>activemq</code> {'\u2192'} broker URL</div>
                      <div><code>spring-redis</code> {'\u2192'} Infinispan config</div>
                      <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                        Values use <code>{'${ENV_VAR:fallback}'}</code> syntax.
                        Supply real values via <code>spec.secrets[].envFrom</code>.
                      </div>
                    </div>

                    <Button variant="link" isInline component="a"
                      href={`${consoleFlowUrl(flowNamespace, flowName)}/yaml`}
                      style={{ fontSize: '12px', marginTop: '12px', display: 'block' }}>
                      {'\u270E'} Edit CR to add properties
                    </Button>
                  </div>
                )}
              </div>
            </Tab>

            <Tab eventKey="logs" title={<TabTitleText>Logs</TabTitleText>}>
              <FlowLogsTab flowNamespace={flowNamespace} flowName={flowName} height={tabFillHeight} />
            </Tab>

            <Tab eventKey="cr-status" title={<TabTitleText>Status</TabTitleText>}>
              <pre style={{
                margin: 0, padding: '16px', overflow: 'auto', minHeight: '300px',
                fontFamily: 'var(--pf-global--FontFamily--monospace, "Liberation Mono", consolas, monospace)',
                fontSize: '13px', lineHeight: 1.6,
                backgroundColor: 'var(--integration-bg-dark)',
                color: 'var(--integration-text-primary)',
              }}>{JSON.stringify(flow.status || { phase: 'Pending', message: 'Waiting for reconciliation' }, null, 2)}</pre>
            </Tab>
          </Tabs>
        </div>

        {/* Sidebar */}
        {showSidebarPanel && (
        <Card isCompact isPlain className="integration-workspace__sidebar" style={{ width: '280px', overflow: 'auto', borderTop: '1px solid var(--integration-border)', borderRight: '1px solid var(--integration-border)', borderBottom: '1px solid var(--integration-border)', borderRadius: '0 6px 6px 0' }}>
          <CardBody>
            <TelemetryOverlay flowId={flowName} />
          </CardBody>
          <CardBody>
            <DescriptionList isCompact>
              <DescriptionListGroup>
                <DescriptionListTerm>Resources</DescriptionListTerm>
                <DescriptionListDescription>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(() => {
                      const links = buildPodLinks(flowNamespace, flowName, flow.status?.sonataFlowNamespace);
                      return (
                        <>
                          <Button variant="link" isInline component="a" href={`/integration-flows/${flowName}?tab=logs`}>
                            <span style={{ color: '#2b9af3' }}>{'\u2630'}</span> Logs
                          </Button>
                          <Button variant="link" isInline component="a" href={links.runtimePodsUrl}>
                            <span style={{ color: '#3e8635' }}>{'\u25A3'}</span> Runtime Pods
                          </Button>
                          {!isEphemeral && (
                            <Button variant="link" isInline component="a" href={links.buildPodsUrl}>
                              <span style={{ color: '#6a6e73' }}>{'\u2699'}</span> Build Pods
                            </Button>
                          )}
                          {!isEphemeral && (
                            <Button variant="link" isInline component="a"
                              href={`/k8s/ns/${flowNamespace}/tekton.dev~v1~PipelineRun?labelSelector=platform.io%2Fflow-name%3D${flowName}`}>
                              <span style={{ color: '#f0ab00' }}>{'\u29D7'}</span> PipelineRuns
                            </Button>
                          )}
                          {!isEphemeral && flow.status?.argoApplicationName && (
                            <Button variant="link" isInline component="a"
                              href={`/k8s/ns/openshift-gitops/argoproj.io~v1alpha1~Application/${flow.status.argoApplicationName}`}>
                              <span style={{ color: '#2b9af3' }}>{'\u21BB'}</span> ArgoCD App
                            </Button>
                          )}
                        </>
                      );
                    })()}
                    {flow.spec.gitRepository && !isEphemeral && (
                      <Button variant="link" isInline component="a"
                        href={flow.spec.gitRepository} target="_blank" rel="noopener noreferrer">
                        <span style={{ color: '#8476d1' }}>{'\u2197'}</span> Git Repository
                      </Button>
                    )}
                    {isSonataFlow && (platformConfig?.sonataFlowEnabled !== false) && (() => {
                      const sfName = flow?.status?.sonataFlowName;
                      const sfLink = sfName
                        ? `${sonataFlowConsoleUrl}/Workflow/${sfName}`
                        : sonataFlowConsoleUrl;
                      return (
                        <>
                          <Button variant="link" isInline component="a" href={sfLink} target="_blank" rel="noopener noreferrer">
                            <span style={{ color: '#009596' }}>{'\u29BF'}</span> SonataFlow Console
                          </Button>
                          {sfName && (
                            <Button variant="link" isInline component="a"
                              href={`/k8s/ns/${flow?.status?.sonataFlowNamespace || 'kogito-bpm'}/sonataflow.org~v1alpha08~SonataFlow/${sfName}`}>
                              <span style={{ color: '#009596' }}>{'\u2699'}</span> SonataFlow CR
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup>
                <DescriptionListTerm>Target Clusters</DescriptionListTerm>
                <DescriptionListDescription>
                  {formatTargetClusters(flow.spec)}
                </DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup>
                <DescriptionListTerm>State</DescriptionListTerm>
                <DescriptionListDescription>
                  <Label color={currentState === 'running' ? 'green' : currentState === 'paused' ? 'yellow' : 'red'} isCompact>
                    {currentState}
                  </Label>
                </DescriptionListDescription>
              </DescriptionListGroup>

              {flow.spec.resilience?.circuitBreaker && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Circuit Breaker</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Label color={circuitState === 'open' ? 'red' : circuitState === 'half-open' ? 'yellow' : 'green'} isCompact>
                      {circuitState === 'open' ? '\u26A0' : circuitState === 'half-open' ? '\u29D7' : '\u2713'} {circuitState}
                    </Label>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {flow.spec.schedule && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Schedule</DescriptionListTerm>
                  <DescriptionListDescription>
                    <code style={{ fontSize: '11px' }}>{flow.spec.schedule}</code>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {flow.spec.resilience?.retry && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Retry Policy</DescriptionListTerm>
                  <DescriptionListDescription>
                    <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                      {flow.spec.resilience.retry.maxAttempts || 3}x {flow.spec.resilience.retry.backoff || 'exponential'}
                    </span>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {flow.status?.gitCommitHash && !isEphemeral && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Last Commit</DescriptionListTerm>
                  <DescriptionListDescription>
                    <code style={{ fontSize: '12px' }}>{flow.status.gitCommitHash.substring(0, 8)}</code>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {isEphemeral && (
                <DescriptionListGroup>
                  <DescriptionListTerm>IntegrationFlow CR</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Button variant="link" isInline component="a"
                      href={consoleFlowUrl(flowNamespace, flowName)}>
                      <span style={{ color: '#2b9af3' }}>{'\u2699'}</span> View CR YAML
                    </Button>
                    <Button variant="link" isInline component="a"
                      href={`${consoleFlowUrl(flowNamespace, flowName)}/yaml`}
                      style={{ display: 'block', marginTop: '2px' }}>
                      <span style={{ color: '#8476d1' }}>{'\u270E'}</span> Edit CR YAML
                    </Button>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {isEphemeral && flow.status?.ephemeralWorkerRef && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Ephemeral Worker</DescriptionListTerm>
                  <DescriptionListDescription>
                    <code style={{ fontSize: '11px' }}>{flow.status.ephemeralWorkerRef}</code>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {isEphemeral && flow.status?.ephemeralExpiresAt && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Expires At</DescriptionListTerm>
                  <DescriptionListDescription>
                    <span style={{ fontSize: '12px' }}>{new Date(flow.status.ephemeralExpiresAt).toLocaleString()}</span>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {isEphemeral && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Properties</DescriptionListTerm>
                  <DescriptionListDescription>
                    {flow.spec.ephemeral?.properties && Object.keys(flow.spec.ephemeral.properties).length > 0 ? (
                      <div style={{ fontSize: '11px' }}>
                        <span style={{ color: '#3e8635' }}>{'\u2713'}</span> {Object.keys(flow.spec.ephemeral.properties).length} custom properties
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>None configured</span>
                    )}
                    {flow.spec.secrets && flow.spec.secrets.length > 0 && (
                      <div style={{ fontSize: '11px', marginTop: '2px' }}>
                        <span style={{ color: '#f0ab00' }}>{'\uD83D\uDD12'}</span> {flow.spec.secrets.length} secret{flow.spec.secrets.length > 1 ? 's' : ''} mounted
                      </div>
                    )}
                    <Button variant="link" isInline
                      onClick={() => { setActiveTab('spec'); syncTabToUrl('spec'); }}
                      style={{ fontSize: '11px', marginTop: '4px', display: 'block' }}>
                      Configure properties {'\u2192'}
                    </Button>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {flow.spec.alerting?.enabled && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Alerting</DescriptionListTerm>
                  <DescriptionListDescription>
                    <span style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                      Error rate &gt; {((flow.spec.alerting.errorRateThreshold || 0.05) * 100).toFixed(0)}%
                    </span>
                    {flow.status?.prometheusRuleName && (
                      <div><code style={{ fontSize: '10px' }}>{flow.status.prometheusRuleName}</code></div>
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {flow.spec.owner && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Owner</DescriptionListTerm>
                  <DescriptionListDescription>
                    <div style={{ fontSize: '12px' }}>{flow.spec.owner}</div>
                    {flow.spec.editors?.length ? <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Editors: {flow.spec.editors.join(', ')}</div> : null}
                    {flow.spec.viewers?.length ? <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Viewers: {flow.spec.viewers.join(', ')}</div> : null}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}

              {flow.status?.message && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Message</DescriptionListTerm>
                  <DescriptionListDescription>
                    <span style={{ fontSize: '12px', color: phase === 'Error' ? '#c9190b' : 'inherit' }}>{flow.status.message}</span>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
            </DescriptionList>
          </CardBody>
        </Card>
        )}
      </div>
    </PageSection>
  );
};

export default FlowDesignerPage;
export { FlowDesignerPage };
