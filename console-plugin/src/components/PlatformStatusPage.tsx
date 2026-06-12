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
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';

import { API_BASE, PLATFORM_NAMESPACE, PROXY_BASE } from '../constants';
import { integrationFlowsUrl } from '../utils/k8sUrls';
import { useFlowNamespace } from '../hooks/useFlowNamespace';

const K8S_CORE = '/api/kubernetes/api/v1';
const K8S_APPS = '/api/kubernetes/apis/apps/v1';
const K8S_TEKTON = '/api/kubernetes/apis/tekton.dev/v1';
const K8S_ARGO = '/api/kubernetes/apis/argoproj.io/v1alpha1';

interface PlatformConfig {
  gitProvider?: string;
  tektonEnabled?: boolean;
}

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

type LabelColor = 'blue' | 'teal' | 'green' | 'orange' | 'purple' | 'red' | 'grey' | 'yellow';

const statusLabelColor: Record<string, LabelColor> = {
  healthy: 'green',
  degraded: 'orange',
  error: 'red',
  checking: 'grey',
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

const PlatformStatusPage: React.FC = () => {
  const flowNamespace = useFlowNamespace();
  const [services, setServices] = React.useState<ServiceCheck[]>([]);
  const [pods, setPods] = React.useState<PodInfo[]>([]);
  const [flowCount, setFlowCount] = React.useState(0);
  const [ephemeralCount, setEphemeralCount] = React.useState(0);
  const [gitOpsCount, setGitOpsCount] = React.useState(0);
  const [pipelineCount, setPipelineCount] = React.useState(0);
  const [argoApps, setArgoApps] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [lastRefresh, setLastRefresh] = React.useState('');

  const checkServices = React.useCallback(async () => {
    const checks: ServiceCheck[] = [];

    let gitOpsCount = 0;
    let giteaRepoCount = 0;
    let flowItems: Array<{ spec?: { deploymentMode?: string; gitRepository?: string } }> = [];
    try {
      let resp = await fetch(integrationFlowsUrl());
      if (!resp.ok) {
        resp = await fetch(integrationFlowsUrl(flowNamespace));
      }
      if (resp.ok) {
        const data = await resp.json();
        flowItems = data.items || [];
        setFlowCount(flowItems.length);
        setEphemeralCount(flowItems.filter(f => f.spec?.deploymentMode === 'EPHEMERAL').length);
        for (const f of flowItems) {
          if (f.spec?.deploymentMode !== 'EPHEMERAL') {
            gitOpsCount++;
          }
          const repo = (f.spec?.gitRepository || '').toLowerCase();
          if (repo.includes('gitea')) {
            giteaRepoCount++;
          }
        }
      }
    } catch { /* ignore */ }
    setGitOpsCount(gitOpsCount);

    let gitProvider = 'auto';
    let tektonEnabled = true;
    try {
      const cfgResp = await fetch(`${PROXY_BASE}/api/config`);
      if (cfgResp.ok) {
        const cfg: PlatformConfig = await cfgResp.json();
        gitProvider = (cfg.gitProvider || 'auto').toLowerCase();
        tektonEnabled = cfg.tektonEnabled !== false;
      }
    } catch { /* ignore */ }

    const showGitOpsServices = gitOpsCount > 0;
    const showGitea = showGitOpsServices
      && (gitProvider === 'gitea' || (gitProvider === 'auto' && giteaRepoCount > 0));

    try {
      const resp = await fetch(`${K8S_APPS}/namespaces/${PLATFORM_NAMESPACE}/deployments/openshift-integration-operator`);
      if (resp.ok) {
        const dep = await resp.json();
        const ready = dep.status?.readyReplicas || 0;
        const desired = dep.spec?.replicas || 1;
        checks.push({
          name: 'Integration Operator',
          description: 'Quarkus operator reconciling IntegrationFlow CRs',
          status: ready >= desired ? 'healthy' : ready > 0 ? 'degraded' : 'error',
          detail: `${ready}/${desired} replicas ready`,
          link: `/k8s/ns/${PLATFORM_NAMESPACE}/deployments/openshift-integration-operator`,
        });
      } else {
        checks.push({ name: 'Integration Operator', description: 'Quarkus operator', status: 'error', detail: `HTTP ${resp.status}` });
      }
    } catch (e: any) {
      checks.push({ name: 'Integration Operator', description: 'Quarkus operator', status: 'error', detail: e.message });
    }

    try {
      const resp = await fetch(`${K8S_APPS}/namespaces/${PLATFORM_NAMESPACE}/deployments/integration-console-plugin`);
      if (resp.ok) {
        const dep = await resp.json();
        const ready = dep.status?.readyReplicas || 0;
        checks.push({
          name: 'Console Plugin',
          description: 'OpenShift Console Dynamic Plugin serving this UI',
          status: ready > 0 ? 'healthy' : 'error',
          detail: `${ready}/${dep.spec?.replicas || 1} replicas`,
          link: `/k8s/ns/${PLATFORM_NAMESPACE}/deployments/integration-console-plugin`,
        });
      } else {
        checks.push({ name: 'Console Plugin', description: 'Dynamic Plugin', status: 'error', detail: 'Not found' });
      }
    } catch { checks.push({ name: 'Console Plugin', description: 'Dynamic Plugin', status: 'error', detail: 'Unreachable' }); }

    try {
      const resp = await fetch(`${K8S_APPS}/namespaces/${PLATFORM_NAMESPACE}/deployments/kaoto`);
      if (resp.ok) {
        const dep = await resp.json();
        const ready = dep.status?.readyReplicas || 0;
        checks.push({
          name: 'Kaoto Designer',
          description: 'Visual editor for Apache Camel integrations',
          status: ready > 0 ? 'healthy' : 'error',
          detail: `${ready}/${dep.spec?.replicas || 1} replicas`,
          link: `/k8s/ns/${PLATFORM_NAMESPACE}/deployments/kaoto`,
        });
      } else {
        checks.push({ name: 'Kaoto Designer', description: 'Visual editor', status: 'degraded', detail: 'Deployment not found' });
      }
    } catch { checks.push({ name: 'Kaoto Designer', description: 'Visual editor', status: 'error', detail: 'Unreachable' }); }

    if (showGitea) {
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
    }

    if (showGitOpsServices) {
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
    }

    let pipelineExists = false;
    if (tektonEnabled) {
      try {
        const resp = await fetch(`${K8S_TEKTON}/namespaces/${PLATFORM_NAMESPACE}/pipelines/integration-flow-build`);
        pipelineExists = resp.ok;
      } catch { /* ignore */ }
    }

    if (showGitOpsServices || pipelineExists) {
      checks.push({
        name: 'Tekton Pipeline',
        description: 'CI pipeline for building worker container images',
        status: pipelineExists ? 'healthy' : 'degraded',
        detail: pipelineExists ? 'integration-flow-build ready' : 'Pipeline not deployed yet',
        link: `/k8s/ns/${PLATFORM_NAMESPACE}/tekton.dev~v1~Pipeline/integration-flow-build`,
      });
    }

    try {
      const resp = await fetch(`${K8S_APPS}/namespaces/${PLATFORM_NAMESPACE}/deployments/integration-otel-collector`);
      if (resp.ok) {
        const dep = await resp.json();
        const ready = dep.status?.readyReplicas || 0;
        checks.push({
          name: 'OpenTelemetry Collector',
          description: 'Receives traces and metrics from worker pods',
          status: ready > 0 ? 'healthy' : 'degraded',
          detail: `${ready} replicas`,
          link: `/k8s/ns/${PLATFORM_NAMESPACE}/deployments/integration-otel-collector`,
        });
      } else {
        checks.push({ name: 'OpenTelemetry Collector', description: 'Telemetry aggregation', status: 'degraded', detail: 'Not deployed' });
      }
    } catch { checks.push({ name: 'OpenTelemetry Collector', description: 'Telemetry', status: 'degraded', detail: 'Cannot check' }); }

    setServices(checks);

    try {
      const resp = await fetch(`${K8S_TEKTON}/namespaces/${PLATFORM_NAMESPACE}/pipelineruns?labelSelector=platform.io%2Fcomponent%3Dbuild&limit=100`);
      if (resp.ok) { const data = await resp.json(); setPipelineCount((data.items || []).length); }
    } catch { /* ignore */ }

    try {
      const resp = await fetch(`${K8S_ARGO}/namespaces/openshift-gitops/applicationsets`);
      if (resp.ok) { const data = await resp.json(); setArgoApps((data.items || []).length); }
    } catch { /* ignore */ }

    try {
      const resp = await fetch(`${K8S_CORE}/namespaces/${PLATFORM_NAMESPACE}/pods`);
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
  }, [flowNamespace]);

  React.useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 15000);
    return () => clearInterval(interval);
  }, [checkServices]);

  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const totalCount = services.length;

  return (
    <PageSection>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <Title headingLevel="h1" size="xl">Platform Status</Title>
          <span style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>
            {healthyCount}/{totalCount} services healthy &middot; Last checked: {lastRefresh || 'loading...'}
          </span>
        </div>
        <Button variant="secondary" onClick={() => { setLoading(true); checkServices(); }}>
          {'\u21BB'} Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <Card isCompact style={{ borderLeft: '3px solid #2b9af3' }}>
          <CardBody>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#2b9af3' }}>{flowCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>Integration Flows</div>
          </CardBody>
        </Card>
        <Card isCompact style={{ borderLeft: '3px solid #f0ab00' }}>
          <CardBody>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#f0ab00' }}>{pipelineCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>PipelineRuns</div>
          </CardBody>
        </Card>
        <Card isCompact style={{ borderLeft: '3px solid #8476d1' }}>
          <CardBody>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#8476d1' }}>{argoApps}</div>
            <div style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>ArgoCD ApplicationSets</div>
          </CardBody>
        </Card>
        <Card isCompact style={{ borderLeft: '3px solid #009596' }}>
          <CardBody>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#009596' }}>{ephemeralCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>Ephemeral (Quick Try)</div>
            <Button variant="link" isInline component="a" href="/integration-flows" style={{ fontSize: '12px', padding: 0, marginTop: '4px' }}>
              Create Quick Try flow
            </Button>
          </CardBody>
        </Card>
        <Card isCompact style={{ borderLeft: `3px solid ${healthyCount === totalCount ? '#3e8635' : '#f0ab00'}` }}>
          <CardBody>
            <div style={{ fontSize: '28px', fontWeight: 700, color: healthyCount === totalCount ? '#3e8635' : '#f0ab00' }}>
              {healthyCount}/{totalCount}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--integration-text-subtle)' }}>Services Healthy</div>
          </CardBody>
        </Card>
      </div>

      {!loading && gitOpsCount === 0 && (
        <Alert variant="info" isInline title="GitOps services hidden" style={{ marginBottom: '16px' }}>
          Gitea, ArgoCD and Tekton checks are shown only when at least one Integration Flow uses GitOps mode.
          Quick Try (ephemeral) flows do not require them.
        </Alert>
      )}

      {/* Service checks */}
      <Title headingLevel="h2" size="lg" style={{ marginBottom: '12px' }}>External Services</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {loading && services.length === 0 ? (
          <Spinner size="lg" aria-label="Checking services" />
        ) : (
          services.map(svc => (
            <Card key={svc.name} isCompact>
              <CardBody>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{svc.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--integration-text-subtle)' }}>{svc.description}</div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <Label color={statusLabelColor[svc.status] || 'grey'} isCompact>{svc.status.toUpperCase()}</Label>
                      <div style={{ fontSize: '11px', color: 'var(--integration-text-subtle)', marginTop: '2px' }}>{svc.detail}</div>
                    </div>
                    {svc.link && (
                      <Button variant="link" isInline component="a" href={svc.link} style={{ fontSize: '12px' }}>{'\u2197'}</Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      {/* Platform Pods */}
      <Title headingLevel="h2" size="lg" style={{ marginBottom: '12px' }}>Platform Pods ({pods.length})</Title>
      <Table aria-label="Platform Pods" variant="compact">
        <Thead>
          <Tr>
            <Th>Pod</Th>
            <Th>Component</Th>
            <Th>Status</Th>
            <Th>Restarts</Th>
            <Th>Age</Th>
          </Tr>
        </Thead>
        <Tbody>
          {pods.map(pod => {
            const component = pod.labels['app.kubernetes.io/name'] || pod.labels['app'] || pod.labels['platform.io/component'] || 'unknown';
            const podLabelColor: LabelColor = pod.phase === 'Running' && pod.ready ? 'green' : pod.phase === 'Running' ? 'orange' : 'red';
            return (
              <Tr key={pod.name}>
                <Td dataLabel="Pod">
                  <a href={`/k8s/ns/${PLATFORM_NAMESPACE}/pods/${pod.name}`}
                    style={{ color: 'var(--integration-link)', textDecoration: 'none' }}>
                    {pod.name}
                  </a>
                </Td>
                <Td dataLabel="Component" style={{ color: 'var(--integration-text-subtle)' }}>{component}</Td>
                <Td dataLabel="Status">
                  <Label color={podLabelColor} isCompact>
                    {pod.ready ? '\u2713' : '\u25CB'} {pod.phase}
                  </Label>
                </Td>
                <Td dataLabel="Restarts" style={{ color: pod.restarts > 0 ? '#f0ab00' : 'var(--integration-text-subtle)' }}>
                  {pod.restarts}
                </Td>
                <Td dataLabel="Age" style={{ color: 'var(--integration-text-subtle)' }}>{pod.age}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </PageSection>
  );
};

export default PlatformStatusPage;
export { PlatformStatusPage };
