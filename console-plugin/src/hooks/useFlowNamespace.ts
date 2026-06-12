import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { PLATFORM_NAMESPACE } from '../constants';

/** Namespace for flow CRUD — active OpenShift project, with platform default fallback. */
export function useFlowNamespace(): string {
  const [activeNamespace] = useActiveNamespace();
  return activeNamespace || PLATFORM_NAMESPACE;
}
