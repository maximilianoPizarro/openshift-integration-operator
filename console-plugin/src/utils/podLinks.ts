import { NAMESPACE } from '../constants';

export interface PodLinkSet {
  runtimePodsUrl: string;
  buildPodsUrl: string;
  logsUrl: (flowName: string) => string;
}

export function buildPodLinks(flowName: string, sonataFlowNs?: string): PodLinkSet {
  const runtimeSelector = encodeURIComponent(`platform.io/flow-name=${flowName}`);
  const buildSelector = encodeURIComponent(`platform.io/flow-name=${flowName},platform.io/component=build`);
  const ns = NAMESPACE;
  const sfNs = sonataFlowNs || 'kogito-bpm';

  return {
    runtimePodsUrl: `/k8s/ns/${ns}/core~v1~Pod?labelSelector=${runtimeSelector}`,
    buildPodsUrl: `/k8s/ns/${ns}/core~v1~Pod?labelSelector=${buildSelector}`,
    logsUrl: (name: string) => `/integration-flows/${name}?tab=logs`,
    sonataFlowPodsUrl: `/k8s/ns/${sfNs}/core~v1~Pod?labelSelector=${encodeURIComponent(`platform.io/flow-name=${flowName}`)}`,
  } as PodLinkSet & { sonataFlowPodsUrl: string };
}

export function consolePodLogsUrl(namespace: string, podName: string, container?: string): string {
  const base = `/k8s/ns/${namespace}/core~v1~Pod/${podName}/logs`;
  return container ? `${base}?container=${encodeURIComponent(container)}` : base;
}
