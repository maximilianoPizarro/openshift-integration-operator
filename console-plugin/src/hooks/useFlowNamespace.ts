import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';

/**
 * Active OpenShift project for flow CRUD. Empty when no project is selected —
 * callers must block create/list until the user picks a namespace.
 */
export function useFlowNamespace(): string {
  const [activeNamespace] = useActiveNamespace();
  return activeNamespace || '';
}
