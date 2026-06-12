import { DOCS_BASE_URL, FLOW_CATALOG_URL, PROXY_BASE } from '../constants';

export interface PlatformConfig {
  flowCatalogSource?: string;
  flowCatalogConfigMapName?: string;
  consolePluginVersion?: string;
}

let cachedConfig: PlatformConfig | null = null;
let configPromise: Promise<PlatformConfig> | null = null;

export async function loadPlatformConfig(): Promise<PlatformConfig> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;

  configPromise = fetch(`${PROXY_BASE}/api/config`)
    .then(r => (r.ok ? r.json() : {}))
    .then((cfg: PlatformConfig) => {
      cachedConfig = cfg;
      return cfg;
    })
    .catch(() => ({}))
    .finally(() => {
      configPromise = null;
    });

  return configPromise;
}

export async function resolveFlowCatalogUrl(): Promise<string> {
  const cfg = await loadPlatformConfig();
  if ((cfg.flowCatalogSource || '').toLowerCase() === 'configmap') {
    return `${PROXY_BASE}/api/flow-catalog`;
  }
  return FLOW_CATALOG_URL;
}

export function offlineCatalogDocsUrl(): string {
  return `${DOCS_BASE_URL}/operations.html#offline-catalog`;
}

export async function fetchFlowCatalog(): Promise<unknown> {
  const url = await resolveFlowCatalogUrl();
  const resp = await fetch(url);
  if (!resp.ok) {
    const cfg = await loadPlatformConfig();
    if ((cfg.flowCatalogSource || '').toLowerCase() === 'configmap') {
      let detail = `HTTP ${resp.status}`;
      try {
        const body = await resp.json();
        if (body?.hint) detail = body.hint;
        else if (body?.error) detail = body.error;
      } catch { /* ignore */ }
      throw new Error(`Offline catalog unavailable: ${detail}. See ${offlineCatalogDocsUrl()}`);
    }
    throw new Error(`HTTP ${resp.status} loading flow catalog`);
  }
  return resp.json();
}
