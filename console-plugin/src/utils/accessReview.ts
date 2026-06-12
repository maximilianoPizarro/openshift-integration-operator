import { getCsrfToken } from './proxyFetch';

const SAR_URL = '/api/kubernetes/apis/authorization.k8s.io/v1/selfsubjectaccessreviews';

async function selfSubjectAccessReview(
  resourceAttributes: Record<string, string | undefined>,
): Promise<boolean> {
  try {
    const resp = await fetch(SAR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        apiVersion: 'authorization.k8s.io/v1',
        kind: 'SelfSubjectAccessReview',
        spec: { resourceAttributes },
      }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return data?.status?.allowed === true;
  } catch {
    return false;
  }
}

/** True when the user may list IntegrationFlows cluster-wide (typically cluster-admin). */
export async function canListAllIntegrationFlows(): Promise<boolean> {
  return selfSubjectAccessReview({
    group: 'platform.io',
    resource: 'integrationflows',
    verb: 'list',
  });
}

export async function canCreateIntegrationFlow(namespace: string): Promise<boolean> {
  return selfSubjectAccessReview({
    group: 'platform.io',
    resource: 'integrationflows',
    namespace,
    verb: 'create',
  });
}
