import { API_BASE } from '../constants';

export function flowApiPath(namespace: string, name: string, suffix = ''): string {
  const ns = encodeURIComponent(namespace);
  const flowName = encodeURIComponent(name);
  return `/api/namespaces/${ns}/flows/${flowName}${suffix}`;
}

export function integrationFlowsUrl(namespace?: string): string {
  if (namespace) {
    return `${API_BASE}/namespaces/${encodeURIComponent(namespace)}/integrationflows`;
  }
  return `${API_BASE}/integrationflows`;
}

export function integrationFlowUrl(namespace: string, name: string): string {
  return `${API_BASE}/namespaces/${encodeURIComponent(namespace)}/integrationflows/${encodeURIComponent(name)}`;
}

export function consoleFlowUrl(namespace: string, name: string): string {
  return `/k8s/ns/${encodeURIComponent(namespace)}/platform.io~v1alpha1~IntegrationFlow/${encodeURIComponent(name)}`;
}

export function designerRoute(namespace: string, name: string): string {
  return `/integration-flows/ns/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;
}
