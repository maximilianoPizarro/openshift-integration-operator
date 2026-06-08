import * as React from 'react';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  EmptyStateBody,
  FormSelect,
  FormSelectOption,
  Label,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  PageSection,
  Pagination,
  SearchInput,
  Spinner,
  TextInput,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { SearchIcon, CubesIcon } from '@patternfly/react-icons';
import EphemeralModeToggle from './ephemeral/EphemeralModeToggle';
import EphemeralBadge from './ephemeral/EphemeralBadge';
import ConfirmDeleteModal from './modals/ConfirmDeleteModal';
import ConfirmLifecycleModal from './modals/ConfirmLifecycleModal';
import TemplateCatalogModal, { TemplateSelection } from './modals/TemplateCatalogModal';
import { API_BASE as K8S_FLOW_API, NAMESPACE, PROXY_BASE } from '../constants';
import { buildPodLinks } from '../utils/podLinks';

const API_BASE = K8S_FLOW_API;
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
    gitRepository?: string;
    branch: string;
    deploymentMode?: string;
    ephemeral?: { ttlSeconds?: number };
    targetClusters?: string[];
    targeting?: { strategy: string; clusters: string[] };
  };
  status?: {
    phase: string;
    message?: string;
    gitCommitHash?: string;
    argoApplicationName?: string;
    applicationSetName?: string;
    deploymentMode?: string;
    ephemeralExpiresAt?: string;
    ephemeralWorkerRef?: string;
    sonataFlowName?: string;
    sonataFlowNamespace?: string;
    currentState?: string;
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
  { value: 'Expired', label: 'Expired' },
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

type LabelColor = 'blue' | 'teal' | 'green' | 'orange' | 'purple' | 'red' | 'grey' | 'yellow';

const typeToLabelColor: Record<string, LabelColor> = {
  CAMEL_ROUTE: 'yellow',
  CAMEL_KAMELET: 'purple',
  CAMEL_PIPE: 'blue',
  CAMEL_TEST: 'green',
  SONATAFLOW: 'teal',
};

const phaseToLabelColor: Record<string, LabelColor> = {
  Running: 'green',
  Building: 'yellow',
  Scaffolding: 'purple',
  Deploying: 'blue',
  PartiallyHealthy: 'orange',
  Error: 'red',
  Pending: 'grey',
  Expired: 'red',
  Paused: 'orange',
  Stopped: 'grey',
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

const IntegrationFlowPage: React.FC = () => {
  const [flows, setFlows] = React.useState<IntegrationFlow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newEngine, setNewEngine] = React.useState<string>('CAMEL_ROUTE');
  const [creating, setCreating] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const [lifecycleModal, setLifecycleModal] = React.useState<{ name: string; action: 'pause' | 'stop' } | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [openKebab, setOpenKebab] = React.useState<string | null>(null);
  const [ephemeralMode, setEphemeralMode] = React.useState(true);
  const [ttlSeconds, setTtlSeconds] = React.useState(3600);
  const [showTemplateModal, setShowTemplateModal] = React.useState(false);
  const [templateDesign, setTemplateDesign] = React.useState('');
  const [templateLoaded, setTemplateLoaded] = React.useState('');

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

  const handleTemplateSelect = (selection: TemplateSelection) => {
    setNewName(`${selection.templateName}-1`);
    setNewEngine(selection.type);
    setTemplateDesign(selection.kaotoDesign);
    setTemplateLoaded(selection.templateName);
    setShowCreate(true);
  };

  const clearTemplate = () => {
    setTemplateDesign('');
    setTemplateLoaded('');
  };

  const handleCreate = async () => {
    const flowName = newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '');
    if (!flowName) return;
    setCreating(true);
    try {
      const spec: Record<string, unknown> = {
          integrationType: newEngine,
          engine: newEngine.startsWith('CAMEL') ? 'CAMEL' : 'SONATAFLOW',
          kaotoDesign: templateDesign || defaultDesign[newEngine] || '',
          targeting: { strategy: 'explicit', clusters: ['local'] },
        };
      if (ephemeralMode) {
        spec.deploymentMode = 'EPHEMERAL';
        spec.ephemeral = { ttlSeconds };
      } else {
        spec.deploymentMode = 'GITOPS';
        spec.gitRepository = `https://gitea-gitea.apps.cluster-xtvzv.dynamic.redhatworkshops.io/user1/${flowName}`;
        spec.branch = 'main';
      }
      const newFlow = {
        apiVersion: 'platform.io/v1alpha1',
        kind: 'IntegrationFlow',
        metadata: { name: flowName, namespace: NAMESPACE },
        spec,
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
      clearTemplate();
      await fetchFlows();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    setActionLoading(true);
    try {
      const resp = await k8sFetch(`${API_BASE}/namespaces/${NAMESPACE}/integrationflows/${name}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setDeleteTarget(null);
      await fetchFlows();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const changeState = async (name: string, desiredState: string) => {
    setActionLoading(true);
    try {
      const resp = await fetch(`${PROXY_BASE}/api/flows/${name}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desiredState }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setLifecycleModal(null);
      await fetchFlows();
    } catch (e: any) {
      alert(`State change failed: ${e.message}`);
    } finally {
      setActionLoading(false);
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
    <PageSection>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <Title headingLevel="h1" size="xl">Integration Flows</Title>
          <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
            {flows.length} flow{flows.length !== 1 ? 's' : ''} in {NAMESPACE}
          </span>
        </div>
        <Button
          variant={showCreate ? 'secondary' : 'primary'}
          onClick={() => {
            if (showCreate) {
              setShowCreate(false);
              clearTemplate();
            } else {
              setShowCreate(true);
            }
          }}
        >
          {showCreate ? 'Cancel' : '+ Create Flow'}
        </Button>
      </div>

      {/* Summary labels */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
        {INTEGRATION_TYPES.map(t => {
          const count = typeCounts[t.value] || 0;
          if (count === 0) return null;
          const active = filterType === t.value;
          return (
            <Label
              key={t.value}
              color={typeToLabelColor[t.value] || 'grey'}
              variant={active ? 'filled' : 'outline'}
              onClick={() => setFilterType(active ? '' : t.value)}
              icon={<span>{t.icon}</span>}
              style={{ cursor: 'pointer' }}
            >
              {t.label} <Badge isRead>{count}</Badge>
            </Label>
          );
        })}
        <span style={{ width: 1, backgroundColor: 'var(--pf-global--BorderColor--100, #3c3f42)', margin: '0 4px', alignSelf: 'stretch' }} />
        {Object.entries(phaseCounts).map(([ph, count]) => {
          const active = filterPhase === ph;
          return (
            <Label
              key={ph}
              color={phaseToLabelColor[ph] || 'grey'}
              variant={active ? 'filled' : 'outline'}
              onClick={() => setFilterPhase(active ? '' : ph)}
              style={{ cursor: 'pointer' }}
            >
              {(phaseMeta[ph] || phaseMeta.Pending).icon} {ph} <Badge isRead>{count}</Badge>
            </Label>
          );
        })}
      </div>

      {error && (
        <Alert variant="danger" isInline title={`Error loading flows: ${error}`} style={{ marginBottom: '12px' }} />
      )}

      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        resourceName={deleteTarget || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        loading={actionLoading}
      />
      <ConfirmLifecycleModal
        isOpen={lifecycleModal !== null}
        action={lifecycleModal?.action || 'pause'}
        flowName={lifecycleModal?.name || ''}
        onClose={() => setLifecycleModal(null)}
        onConfirm={() => lifecycleModal && changeState(lifecycleModal.name, lifecycleModal.action === 'pause' ? 'paused' : 'stopped')}
        loading={actionLoading}
      />

      <TemplateCatalogModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelect={handleTemplateSelect}
      />

      {showCreate && (
        <div style={{ padding: '14px', borderRadius: '6px', marginBottom: '14px', border: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)', background: 'var(--pf-global--BackgroundColor--200, #f0f0f0)' }}>
          {templateLoaded && (
            <Alert
              variant="info"
              isInline
              title={`Template loaded: ${templateLoaded}`}
              style={{ marginBottom: '12px' }}
              actionClose={<Button variant="plain" onClick={clearTemplate} aria-label="Clear template">Clear template</Button>}
            >
              Customize the route below to fit your use case, then click Create. The flow will be fully independent after creation.
            </Alert>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <TextInput
              value={newName}
              onChange={(_event, value) => setNewName(value)}
              onKeyDown={(e) => e.key === 'Enter' && !templateLoaded && handleCreate()}
              placeholder="flow-name"
              aria-label="Flow name"
              style={{ width: '220px' }}
            />
            <FormSelect
              value={newEngine}
              onChange={(_event, value) => setNewEngine(value)}
              aria-label="Integration type"
              style={{ width: '150px' }}
            >
              {INTEGRATION_TYPES.map(t => (
                <FormSelectOption key={t.value} value={t.value} label={t.label} />
              ))}
            </FormSelect>
            <Button variant="primary" onClick={handleCreate} isDisabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
            <Button variant="secondary" onClick={() => setShowTemplateModal(true)}>
              Use Template...
            </Button>
          </div>
          {templateDesign && (
            <div style={{ marginTop: '12px' }}>
              <label htmlFor="template-design-editor" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                kaotoDesign — edit before creating
              </label>
              <textarea
                id="template-design-editor"
                value={templateDesign}
                onChange={(e) => setTemplateDesign(e.target.value)}
                rows={14}
                spellCheck={false}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)',
                  background: 'var(--pf-global--BackgroundColor--100, #fff)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
          <div style={{ marginTop: '12px' }}>
            <EphemeralModeToggle
              ephemeral={ephemeralMode}
              onChange={setEphemeralMode}
              ttlSeconds={ttlSeconds}
              onTtlChange={setTtlSeconds}
            />
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              placeholder="Search flows by name, repo, or message..."
              value={search}
              onChange={(_event, value) => setSearch(value)}
              onClear={() => setSearch('')}
              style={{ minWidth: '220px', maxWidth: '360px' }}
            />
          </ToolbarItem>
          <ToolbarItem>
            <FormSelect
              value={filterType}
              onChange={(_event, value) => setFilterType(value)}
              aria-label="Filter by type"
              style={{ width: '140px' }}
            >
              <FormSelectOption value="" label="All Types" />
              {INTEGRATION_TYPES.map(t => (
                <FormSelectOption key={t.value} value={t.value} label={t.label} />
              ))}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem>
            <FormSelect
              value={filterPhase}
              onChange={(_event, value) => setFilterPhase(value)}
              aria-label="Filter by phase"
              style={{ width: '130px' }}
            >
              {PHASE_ALL.map(p => (
                <FormSelectOption key={p.value} value={p.value} label={p.label} />
              ))}
            </FormSelect>
          </ToolbarItem>
          {(search || filterType || filterPhase) && (
            <ToolbarItem>
              <Button variant="link" onClick={() => { setSearch(''); setFilterType(''); setFilterPhase(''); }}>
                Clear filters
              </Button>
            </ToolbarItem>
          )}
          <ToolbarItem style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spinner size="lg" aria-label="Loading flows" />
        </div>
      ) : paged.length === 0 ? (
        <EmptyState
          variant="full"
          titleText={flows.length === 0 ? 'No IntegrationFlows found' : 'No flows match filters'}
          headingLevel="h2"
          icon={flows.length === 0 ? CubesIcon : SearchIcon}
        >
          <EmptyStateBody>
            {flows.length === 0 ? 'Click Create Flow to get started' : 'Try adjusting your search or filters'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          <Table aria-label="Integration Flows" variant="compact">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Mode</Th>
                <Th>Phase</Th>
                <Th>Clusters</Th>
                <Th>Conditions</Th>
                <Th>Repository</Th>
                <Th>Resources</Th>
                <Th>Age</Th>
                <Th style={{ textAlign: 'right' }}>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {paged.map((flow) => {
                const phase = flow.status?.phase || 'Pending';
                const meta = phaseMeta[phase] || phaseMeta.Pending;
                const conditions = flow.status?.conditions || [];
                const typeInfo = INTEGRATION_TYPES.find(t => t.value === (flow.spec.integrationType || (flow.spec.engine === 'CAMEL' ? 'CAMEL_ROUTE' : 'SONATAFLOW')));
                const flowName = flow.metadata.name;
                const isEphemeral = flow.spec.deploymentMode === 'EPHEMERAL';
                const isExpired = phase === 'Expired';
                return (
                  <Tr key={flow.metadata.uid || flowName}>
                    <Td dataLabel="Name">
                      <a href={`/integration-flows/${flowName}`}
                        style={{ color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none', fontWeight: 500 }}>
                        {flowName}
                      </a>
                    </Td>
                    <Td dataLabel="Type">
                      <Label color={typeToLabelColor[typeInfo?.value || ''] || 'grey'} isCompact icon={<span>{typeInfo?.icon}</span>}>
                        {typeInfo?.label || flow.spec.engine}
                      </Label>
                    </Td>
                    <Td dataLabel="Mode">
                      <EphemeralBadge
                        deploymentMode={flow.spec.deploymentMode || flow.status?.deploymentMode}
                        ephemeralExpiresAt={flow.status?.ephemeralExpiresAt}
                      />
                    </Td>
                    <Td dataLabel="Phase">
                      <Label color={phaseToLabelColor[phase] || 'grey'} isCompact>
                        {meta.icon} {phase}
                      </Label>
                    </Td>
                    <Td dataLabel="Clusters">
                      <span style={{ fontSize: '12px' }}>{clusterSummary(flow.status?.clusterDeployments)}</span>
                    </Td>
                    <Td dataLabel="Conditions">
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
                    </Td>
                    <Td dataLabel="Repository">
                      {flow.spec.gitRepository ? (
                        <>
                          <a href={flow.spec.gitRepository} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none', fontSize: '12px' }}>
                            {flow.spec.gitRepository.split('/').slice(-2).join('/')} {'\u2197'}
                          </a>
                          {flow.status?.gitCommitHash && (
                            <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', fontFamily: 'monospace' }}>
                              @{flow.status.gitCommitHash.substring(0, 7)}
                            </span>
                          )}
                        </>
                      ) : <span style={{ color: 'var(--pf-global--Color--200, #8a8d90)' }}>{'\u2014'}</span>}
                    </Td>
                    <Td dataLabel="Resources">
                      {(() => {
                        const links = buildPodLinks(flowName, flow.status?.sonataFlowNamespace);
                        return (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <Button variant="link" isInline component="a"
                          href={links.logsUrl(flowName)} title="View flow logs">
                          {'\u2630'} Logs
                        </Button>
                        <Button variant="link" isInline component="a"
                          href={links.runtimePodsUrl} title="Runtime pods">
                          {'\u25A3'} Pods
                        </Button>
                        {!isEphemeral && (
                        <Button variant="link" isInline component="a"
                          href={links.buildPodsUrl} title="Build task pods">
                          {'\u2699'} Builds
                        </Button>
                        )}
                        <Button variant="link" isInline component="a"
                          href={consoleUrl(`tekton.dev~v1~PipelineRun?labelSelector=platform.io%2Fflow-name%3D${flowName}`)} title="View PipelineRuns">
                          {'\u29D7'} Pipelines
                        </Button>
                        {flow.status?.argoApplicationName && (
                          <Button variant="link" isInline component="a"
                            href={`/k8s/ns/openshift-gitops/argoproj.io~v1alpha1~Application/${flow.status.argoApplicationName}`} title="View ArgoCD Application">
                            {'\u21BB'} Argo
                          </Button>
                        )}
                      </div>
                        );
                      })()}
                    </Td>
                    <Td dataLabel="Age">
                      <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #8a8d90)' }}>{timeAgo(flow.metadata.creationTimestamp)}</span>
                    </Td>
                    <Td dataLabel="Actions" style={{ textAlign: 'right' }}>
                      <Dropdown
                        isOpen={openKebab === flowName}
                        onOpenChange={(isOpen) => setOpenKebab(isOpen ? flowName : null)}
                        popperProps={{ position: 'right' }}
                        toggle={(toggleRef) => (
                          <MenuToggle ref={toggleRef} onClick={() => setOpenKebab(openKebab === flowName ? null : flowName)} variant="plain">
                            Actions
                          </MenuToggle>
                        )}
                      >
                        <DropdownList>
                          <DropdownItem key="edit" component="a" href={`/integration-flows/${flowName}`}>Edit</DropdownItem>
                          <DropdownItem key="logs" component="a" href={`/integration-flows/${flowName}?tab=logs`}>View logs</DropdownItem>
                          {phase === 'Running' && !isExpired && (
                            <DropdownItem key="pause" onClick={() => { setLifecycleModal({ name: flowName, action: 'pause' }); setOpenKebab(null); }}>Pause</DropdownItem>
                          )}
                          {(phase === 'Paused' || flow.status?.currentState === 'paused') && (
                            <DropdownItem key="resume" onClick={() => { changeState(flowName, 'running'); setOpenKebab(null); }}>Resume</DropdownItem>
                          )}
                          {phase !== 'Stopped' && !isExpired && (
                            <DropdownItem key="stop" onClick={() => { setLifecycleModal({ name: flowName, action: 'stop' }); setOpenKebab(null); }}>Stop</DropdownItem>
                          )}
                          <DropdownItem key="delete" onClick={() => { setDeleteTarget(flowName); setOpenKebab(null); }}>Delete</DropdownItem>
                        </DropdownList>
                      </Dropdown>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>

          {totalPages > 1 && (
            <Pagination
              itemCount={filtered.length}
              perPage={PAGE_SIZE}
              page={safePage}
              onSetPage={(_event, newPage) => setPage(newPage)}
              variant="bottom"
              isCompact
            />
          )}
        </>
      )}
    </PageSection>
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
