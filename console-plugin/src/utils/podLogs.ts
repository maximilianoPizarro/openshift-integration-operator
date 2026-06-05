import { NAMESPACE } from '../constants';
import { getCsrfToken } from './proxyFetch';

const K8S_PODS = `/api/kubernetes/api/v1/namespaces`;

function isRuntimePod(name: string, labels?: Record<string, string>): boolean {
  if (name.includes('fetch-source') || name.includes('build-maven') || name.includes('-build-')) {
    return false;
  }
  if (labels?.['platform.io/component'] === 'build') return false;
  if (labels?.['tekton.dev/pipelineRun'] || labels?.['tekton.dev/taskRun']) return false;
  return true;
}

export async function fetchPodLogsViaK8s(
  flowName: string,
  tailLines: number,
  container?: string,
  sonataFlowNs?: string,
): Promise<{ namespace: string; podName: string; container: string; logs: string }> {
  const namespaces = sonataFlowNs && sonataFlowNs !== NAMESPACE
    ? [NAMESPACE, sonataFlowNs]
    : [NAMESPACE];

  for (const ns of namespaces) {
    const selector = encodeURIComponent(`platform.io/flow-name=${flowName}`);
    const listResp = await fetch(`${K8S_PODS}/${ns}/pods?labelSelector=${selector}`, {
      headers: { 'X-CSRFToken': getCsrfToken() },
      credentials: 'same-origin',
    });
    if (!listResp.ok) continue;
    const list = await listResp.json();
    const pods = (list.items || [])
      .filter((p: any) => p.status?.phase === 'Running' && isRuntimePod(p.metadata.name, p.metadata.labels))
      .sort((a: any, b: any) => (b.metadata.creationTimestamp || '').localeCompare(a.metadata.creationTimestamp || ''));

    if (pods.length === 0) continue;

    const pod = pods[0];
    const podName = pod.metadata.name;
    const containers: string[] = (pod.spec?.containers || []).map((c: any) => c.name);
    const selected = container && containers.includes(container) ? container : containers[0] || '';

    const params = new URLSearchParams({ tailLines: String(tailLines) });
    if (selected) params.set('container', selected);

    const logResp = await fetch(`${K8S_PODS}/${ns}/pods/${podName}/log?${params}`, {
      headers: { 'X-CSRFToken': getCsrfToken() },
      credentials: 'same-origin',
    });
    if (!logResp.ok) {
      throw new Error(`HTTP ${logResp.status} fetching pod logs`);
    }
    const logs = await logResp.text();
    return { namespace: ns, podName, container: selected, logs };
  }

  throw new Error('No running worker pod found for this flow');
}
