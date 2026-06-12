export const PLUGIN_NAME = 'integration-console-plugin';
export const PROXY_BASE = `/api/proxy/plugin/${PLUGIN_NAME}/backend`;
/** Operator install namespace — platform components, not flow CR namespace. */
export const PLATFORM_NAMESPACE = 'openshift-integration';
/** @deprecated Use flow.metadata.namespace or useFlowNamespace() for flow CRs. */
export const NAMESPACE = PLATFORM_NAMESPACE;
export const API_BASE = '/api/kubernetes/apis/platform.io/v1alpha1';
export const K8S_BASE = '/api/kubernetes/apis';
export const DOCS_BASE_URL = 'https://maximilianopizarro.github.io/openshift-integration-operator';
export const FLOW_CATALOG_URL = `${DOCS_BASE_URL}/flow-catalog.json`;
export const GITHUB_REPO_URL = 'https://github.com/maximilianoPizarro/openshift-integration-operator';
