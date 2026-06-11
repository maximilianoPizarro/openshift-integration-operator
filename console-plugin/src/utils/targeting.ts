export interface TargetingSpec {
  strategy?: string;
  clusters?: string[];
}

export interface TargetingFlowSpec {
  targetClusters?: string[];
  targeting?: TargetingSpec;
}

/** Prefer spec.targeting.clusters; fall back to legacy targetClusters. */
export function resolveTargetClusters(spec: TargetingFlowSpec | undefined): string[] {
  if (!spec) {
    return [];
  }
  if (spec.targeting?.clusters?.length) {
    return spec.targeting.clusters;
  }
  return spec.targetClusters || [];
}

export function formatTargetClusters(spec: TargetingFlowSpec | undefined): string {
  const clusters = resolveTargetClusters(spec);
  return clusters.length ? clusters.join(', ') : 'None';
}
