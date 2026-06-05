import * as React from 'react';

const API_BASE = '/api/kubernetes/apis/platform.io/v1alpha1';
const K8S_CORE = '/api/kubernetes/api/v1';
const K8S_APPS = '/api/kubernetes/apis/apps/v1';
const K8S_TEKTON = '/api/kubernetes/apis/tekton.dev/v1';
const K8S_ARGO = '/api/kubernetes/apis/argoproj.io/v1alpha1';
const NAMESPACE = 'openshift-integration';

interface ServiceCheck {
  name: string;
  description: string;
  status: 'healthy' | 'degraded' | 'error' | 'checking';
  detail: string;
  link?: string;
}

interface PodInfo {
  name: string;
  phase: string;
  ready: boolean;
  restarts: number;
  age: string;
  labels: Record<string, string>;
}

const statusIcon: Record<string, { icon: string; color: string }> = {
  healthy:  { icon: '\u2713', color: '#3e8635' },
  degraded: { icon: '\u26A0', color: '#f0ab00' },
  error:    { icon: '\u2716', color: '#c9190b' },
  checking: { icon: '\u29D7', color: '#6a6e73' },
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

const cardStyle: React.CSSProperties = {
  padding: '16px', borderRadius: '8px',
  border: '1px solid var(--pf-global--BorderColor--100, #3c3f42)',
  backgroundColor: 'var(--pf-global--BackgroundColor--200, #151515)',
};

const PlatformStatusPage: React.FC = () => {
  const [services, setServices] = React.useState<ServiceCheck[]>([]);
  const [pods, setPods] = React.useState<PodInfo[]>([]);
  const [flowCount, setFlowCount] = React.useState(0);
  const [pipelineCount, setPipelineCount] = React.useState(0);
  const [argoApps, setArgoApps] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [lastRefresh, setLastRefresh] = React.useState('');

  const checkServices = React.useCallback(async () => {
    const checks: ServiceCheck[] = [];

    // Operator
    try {
      const resp = await fetch(`${K8S_APPS}/namespaces/${NAMESPACE}/deployments/openshift-integration-operator`);
      if (resp.ok) {
        const dep = await resp.json();
        const ready = dep.status?.readyReplicas || 0;
        const desired = dep.spec?.replicas || 1;
        checks.push({
          name: 'Integration Operator',
          description: 'Quarkus operator reconciling IntegrationFlow CRs',
          status: ready >= desired ? 'healthy' : ready > 0 ? 'degraded' : 'error',
          detail: `${ready}/${desired} replicas ready`,
          link: `/k8s/ns/${NAMESPACE}/deployments/openshift-integration-operator`,
        });
      } else {
        checks.push({ name: 'Integration Operator', description: 'Quarkus operator', status: 'error', detail: `HTTP ${resp.status}` });
      }
    } catch (e: any) {
      checks.push({ name: 'Integration Operator', description: 'Quarkus operator', status: 'error', detail: e.message });
    }

    // Console Plugin
    try {
      const resp = await fetch(`${K8S_APPS}/namespaces/${NAMESPACE}/deployments/integration-console-plugin`);
      if (resp.ok) {
        const dep = await resp.json();
        const ready = dep.status?.readyReplicas || 0;
        checks.push({
          name: 'Console Plugin',
          description: 'OpenShift Console Dynamic Plugin serving this UI',
          status: ready > 0 ? 'healthy' : 'error',
          detail: `${ready}/${dep.spec?.replicas || 1} replicas`,
          link: `/k8s/ns/${NAMESPACE}/deployments/integration-console-plugin`,
        });
      } else {
        checks.push({ name: 'Console Plugin', description: 'Dynamic Plugin', status: 'error', detail: 'Not found' });
      }
    } catch { checks.push({ name: 'Console Plugin', description: 'Dynamic Plugin', status: 'error', detail: 'Unreachable' }); }

    // Kaoto
    try {
      const resp = await fetch(`${K8S_APPS}/namespaces/${NAMESPACE}/deployments/kaoto`);
      if (resp.ok) {
        const dep = await resp.json();
        const ready = dep.status?.readyReplicas || 0;
        checks.push({
          name: 'Kaoto Designer',
          description: 'Visual editor for Apache Camel integrations',
          status: ready > 0 ? 'healthy' : 'error',
          detail: `${ready}/${dep.spec?.replicas || 1} replicas`,
          link: `/k8s/ns/${NAMESPACE}/deployments/kaoto`,
        });
      } else {
        checks.push({ name: 'Kaoto Designer', description: 'Visual editor', status: 'degraded', detail: 'Deployment not found' });
      }
    } catch { checks.push({ name: 'Kaoto Designer', description: 'Visual editor', status: 'error', detail: 'Unreachable' }); }

    // Gitea
    try {
      const resp = await fetch(`${K8S_APPS}/namespaces/gitea/deployments`);
      if (resp.ok) {
        const data = await resp.json();
        const gitea = (data.items || []).find((d: any) => d.metadata?.name?.includes('gitea'));
        if (gitea) {
          const ready = gitea.status?.readyReplicas || 0;
          checks.push({
            name: 'Gitea (Git Server)',
            description: 'Hosts scaffolded worker source code repositories',
            status: ready > 0 ? 'healthy' : 'error',
            detail: `${ready} replicas in gitea namespace`,
            link: '/k8s/ns/gitea/deployments',
          });
        } else {
          checks.push({ name: 'Gitea (Git Server)', description: 'Git server', status: 'degraded', detail: 'No gitea deployment found' });
        }
      } else {
        checks.push({ name: 'Gitea (Git Server)', description: 'Git server', status: 'degraded', detail: 'gitea namespace not accessible' });
      }
    } catch { checks.push({ name: 'Gitea (Git Server)', description: 'Git server', status: 'degraded', detail: 'Cannot check' }); }

    // ArgoCD
    try {
      const resp = await fetch(`${K8S_APPS}/namespaces/openshift-gitops/deployments`);
      if (resp.ok) {
        const data = await resp.json();
        const argoServer = (data.items || []).find((d: any) => d.metadata?.name?.includes('server'));
        if (argoServer) {
          const ready = argoServer.status?.readyReplicas || 0;
          checks.push({
            name: 'ArgoCD (GitOps)',
            description: 'Deploys workers to target clusters via ApplicationSets',
            status: ready > 0 ? 'healthy' : 'error',
            detail: `Server: ${ready} replicas`,
            link: '/k8s/ns/openshift-gitops/deployments',
          });
        } else {
          checks.push({ name: 'ArgoCD (GitOps)', description: 'GitOps controller', status: 'error', detail: 'Not found' });
        }
      } else {
        checks.push({ name: 'ArgoCD (GitOps)', description: 'GitOps controller', status: 'degraded', detail: 'openshift-gitops not accessible' });
      }
    } catch { checks.push({ name: 'ArgoCD (GitOps)', description: 'GitOps controller', status: 'error', detail: 'Unreachable' }); }

    // Tekton Pipelines
    try {
      const resp = await fetch(`${K8S_TEKTON}/namespaces/${NAMESPACE}/pipelines/integration-flow-build`);
      checks.push({
        name: 'Tekton Pipeline',
        description: 'CI pipeline for building worker container images',
        status: resp.ok ? 'healthy' : 'error',
        detail: resp.ok ? 'integration-flow-build ready' : 'Pipeline not found',
        link: `/k8s/ns/${NAMESPACE}/tekton.dev~v1~Pipeline/integration-flow-build`,
      });
    } catch { checks.push({ name: 'Tekton Pipeline', description: 'CI pipeline', status: 'error', detail: 'Unreachable' }); }

    // OTel Collector
    try {
      const resp = await fetch(`${K8S_APPS}/namespaces/${NAMESPACE}/deployments/integration-otel-collector`);
      if (resp.ok) {
        const dep = await resp.json();
        const ready = dep.status?.readyReplicas || 0;
        checks.push({
          name: 'OpenTelemetry Collector',
          description: 'Receives traces and metrics from worker pods',
          status: ready > 0 ? 'healthy' : 'degraded',
          detail: `${ready} replicas`,
          link: `/k8s/ns/${NAMESPACE}/deployments/integration-otel-collector`,
        });
      } else {
        checks.push({ name: 'OpenTelemetry Collector', description: 'Telemetry aggregation', status: 'degraded', detail: 'Not deployed' });
      }
    } catch { checks.push({ name: 'OpenTelemetry Collector', description: 'Telemetry', status: 'degraded', detail: 'Cannot check' }); }

    setServices(checks);

    // Fetch counts
    try {
      const resp = await fetch(`${API_BASE}/namespaces/${NAMESPACE}/integrationflows`);
      if (resp.ok) { const data = await resp.json(); setFlowCount((data.items || []).length); }
    } catch { /* ignore */ }

    try {
      const resp = await fetch(`${K8S_TEKTON}/namespaces/${NAMESPACE}/pipelineruns?labelSelector=platform.io%2Fcomponent%3Dbuild&limit=100`);
      if (resp.ok) { const data = await resp.json(); setPipelineCount((data.items || []).length); }
    } catch { /* ignore */ }

    try {
      const resp = await fetch(`${K8S_ARGO}/namespaces/openshift-gitops/applicationsets`);
      if (resp.ok) { const data = await resp.json(); setArgoApps((data.items || []).length); }
    } catch { /* ignore */ }

    // Fetch platform pods
    try {
      const resp = await fetch(`${K8S_CORE}/namespaces/${NAMESPACE}/pods`);
      if (resp.ok) {
        const data = await resp.json();
        const podList: PodInfo[] = (data.items || []).map((p: any) => ({
          name: p.metadata.name,
          phase: p.status?.phase || 'Unknown',
          ready: (p.status?.containerStatuses || []).every((c: any) => c.ready),
          restarts: (p.status?.containerStatuses || []).reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0),
          age: timeAgo(p.metadata.creationTimestamp),
          labels: p.metadata.labels || {},
        }));
        setPods(podList);
      }
    } catch { /* ignore */ }

    setLastRefresh(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 15000);
    return () => clearInterval(interval);
  }, [checkServices]);

  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const totalCount = services.length;

  return (
    <div className="co-m-pane__body" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="co-m-pane__heading" style={{ margin: 0, fontSize: '20px' }}>Platform Status</h1>
          <span className="co-help-text" style={{ fontSize: '12px' }}>
            {healthyCount}/{totalCount} services healthy &middot; Last checked: {lastRefresh || 'loading...'}
          </span>
        </div>
        <button className="pf-c-button pf-m-secondary pf-m-small" onClick={() => { setLoading(true); checkServices(); }}>
          {'\u21BB'} Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ ...cardStyle, borderLeft: '3px solid #2b9af3' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#2b9af3' }}>{flowCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Integration Flows</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '3px solid #f0ab00' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#f0ab00' }}>{pipelineCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>PipelineRuns</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '3px solid #8476d1' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#8476d1' }}>{argoApps}</div>
          <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>ArgoCD ApplicationSets</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: `3px solid ${healthyCount === totalCount ? '#3e8635' : '#f0ab00'}` }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: healthyCount === totalCount ? '#3e8635' : '#f0ab00' }}>
            {healthyCount}/{totalCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>Services Healthy</div>
        </div>
      </div>

      {/* Service checks */}
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>External Services</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {loading && services.length === 0 ? (
          <p className="co-help-text">Checking services...</p>
        ) : (
          services.map(svc => {
            const si = statusIcon[svc.status];
            return (
              <div key={svc.name} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                <span style={{ fontSize: '18px', color: si.color, width: '24px', textAlign: 'center' }}>{si.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{svc.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>{svc.description}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '3px',
                    color: si.color, backgroundColor: `${si.color}22`,
                  }}>{svc.status.toUpperCase()}</span>
                  <div style={{ fontSize: '11px', color: 'var(--pf-global--Color--200, #6a6e73)', marginTop: '2px' }}>{svc.detail}</div>
                </div>
                {svc.link && (
                  <a href={svc.link} style={{ fontSize: '12px', color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none' }}>{'\u2197'}</a>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Platform Pods */}
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Platform Pods ({pods.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--pf-global--Color--200, #8a8d90)', textTransform: 'uppercase' }}>Pod</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--pf-global--Color--200, #8a8d90)', textTransform: 'uppercase' }}>Component</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--pf-global--Color--200, #8a8d90)', textTransform: 'uppercase' }}>Status</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--pf-global--Color--200, #8a8d90)', textTransform: 'uppercase' }}>Restarts</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--pf-global--Color--200, #8a8d90)', textTransform: 'uppercase' }}>Age</th>
          </tr>
        </thead>
        <tbody>
          {pods.map(pod => {
            const component = pod.labels['app.kubernetes.io/name'] || pod.labels['app'] || pod.labels['platform.io/component'] || 'unknown';
            const phaseColor = pod.phase === 'Running' && pod.ready ? '#3e8635' : pod.phase === 'Running' ? '#f0ab00' : '#c9190b';
            return (
              <tr key={pod.name} style={{ borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
                <td style={{ padding: '8px 12px', fontSize: '12px' }}>
                  <a href={`/k8s/ns/${NAMESPACE}/pods/${pod.name}`}
                    style={{ color: 'var(--pf-global--link--Color, #2b9af3)', textDecoration: 'none' }}>
                    {pod.name}
                  </a>
                </td>
                <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>{component}</td>
                <td style={{ padding: '8px 12px', fontSize: '12px' }}>
                  <span style={{ color: phaseColor, fontWeight: 500 }}>
                    {pod.ready ? '\u2713' : '\u25CB'} {pod.phase}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', fontSize: '12px', color: pod.restarts > 0 ? '#f0ab00' : 'var(--pf-global--Color--200, #6a6e73)' }}>
                  {pod.restarts}
                </td>
                <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>{pod.age}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PlatformStatusPage;
export { PlatformStatusPage };
