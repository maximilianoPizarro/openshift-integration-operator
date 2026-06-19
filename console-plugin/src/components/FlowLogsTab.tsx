import '../theme/tokens.css';
import * as React from 'react';
import {
  Alert,
  Button,
  FormSelect,
  FormSelectOption,
  Spinner,
  Switch,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { consolePodLogsUrl } from '../utils/podLinks';
import { proxyFetch } from '../utils/proxyFetch';
import { fetchPodLogsViaK8s } from '../utils/podLogs';
import { flowApiPath } from '../utils/k8sUrls';

export interface FlowLogsTabProps {
  flowNamespace: string;
  flowName: string;
  height?: string;
}

interface LogsResponse {
  namespace: string;
  podName: string;
  container: string;
  containers: string[];
  logs: string;
  timestamp: string;
  error?: string;
}

const FlowLogsTab: React.FC<FlowLogsTabProps> = ({ flowNamespace, flowName, height = 'calc(100vh - 260px)' }) => {
  const [data, setData] = React.useState<LogsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingRuntime, setPendingRuntime] = React.useState(false);
  const [tailLines, setTailLines] = React.useState(500);
  const [follow, setFollow] = React.useState(false);
  const [container, setContainer] = React.useState('');
  const logRef = React.useRef<HTMLPreElement>(null);

  const fetchLogs = React.useCallback(async () => {
    try {
      const params = new URLSearchParams({ tailLines: String(tailLines) });
      if (container) params.set('container', container);

      let json: LogsResponse | null = null;
      const proxyResp = await proxyFetch(`${flowApiPath(flowNamespace, flowName, '/logs')}?${params}`);
      if (proxyResp.ok) {
        json = await proxyResp.json();
      } else if (proxyResp.status === 404 || proxyResp.status === 502 || proxyResp.status === 503) {
        try {
          const k8s = await fetchPodLogsViaK8s(flowNamespace, flowName, tailLines, container || undefined);
          json = {
            ...k8s,
            containers: k8s.container ? [k8s.container] : [],
            timestamp: new Date().toISOString(),
          } as LogsResponse;
        } catch (_fallbackErr) {
          const err = await proxyResp.json().catch(() => ({}));
          const runtimeNotReady = proxyResp.status === 404;
          const wrapped = new Error(
            runtimeNotReady
              ? 'Worker pod is not running yet'
              : (err.error || `HTTP ${proxyResp.status}`),
          ) as Error & { status?: number };
          wrapped.status = proxyResp.status;
          throw wrapped;
        }
      } else {
        const err = await proxyResp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${proxyResp.status}`);
      }

      if (!json) {
        throw new Error('No log response');
      }

      setData(json);
      setError(null);
      setPendingRuntime(false);
      if (!container && json.container) {
        setContainer(json.container);
      }
    } catch (e: any) {
      setError(e.message);
      setPendingRuntime(e?.status === 404);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [flowName, flowNamespace, tailLines, container]);

  React.useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  React.useEffect(() => {
    if (!follow && !pendingRuntime) return undefined;
    const id = setInterval(fetchLogs, pendingRuntime ? 2000 : 3000);
    return () => clearInterval(id);
  }, [fetchLogs, follow, pendingRuntime]);

  React.useEffect(() => {
    if (follow && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [data?.logs, follow]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height }} data-integration-tab-fill>
      <Toolbar style={{ padding: '8px 12px', borderBottom: '1px solid var(--pf-global--BorderColor--100, #3c3f42)' }}>
        <ToolbarContent>
          <ToolbarItem>
            <FormSelect
              value={String(tailLines)}
              onChange={(_e, v) => setTailLines(Number(v))}
              aria-label="Tail lines"
              style={{ width: '120px' }}
            >
              <FormSelectOption value="100" label="100 lines" />
              <FormSelectOption value="500" label="500 lines" />
              <FormSelectOption value="1000" label="1000 lines" />
            </FormSelect>
          </ToolbarItem>
          {data?.containers && data.containers.length > 1 && (
            <ToolbarItem>
              <FormSelect
                value={container}
                onChange={(_e, v) => setContainer(v)}
                aria-label="Container"
                style={{ width: '160px' }}
              >
                {data.containers.map(c => (
                  <FormSelectOption key={c} value={c} label={c} />
                ))}
              </FormSelect>
            </ToolbarItem>
          )}
          <ToolbarItem>
            <Switch
              id="logs-follow"
              label="Follow"
              isChecked={follow}
              onChange={(_e, checked) => setFollow(checked)}
            />
          </ToolbarItem>
          {pendingRuntime && (
            <ToolbarItem>
              <span style={{ fontSize: '12px', color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                Waiting for worker pod startup...
              </span>
            </ToolbarItem>
          )}
          <ToolbarItem align={{ default: 'alignEnd' }}>
            <Button variant="secondary" onClick={fetchLogs}>Refresh</Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {loading && !data && !error && (
        <div style={{ padding: '24px', textAlign: 'center' }}><Spinner size="lg" /></div>
      )}

      {error && (
        <Alert variant="warning" title="No logs available" isInline style={{ margin: '12px' }}>
          {error}. The flow may be stopped, expired, or the worker pod is not running yet.
        </Alert>
      )}

      {data && (
        <div style={{ padding: '8px 12px', fontSize: '11px', color: '#6a6e73', borderBottom: '1px solid #3c3f42' }}>
          {data.namespace}/{data.podName}
          {data.container ? ` (${data.container})` : ''}
          {' · '}
          Updated {new Date(data.timestamp).toLocaleTimeString()}
          {data.podName && (
            <>
              {' · '}
              <Button
                variant="link"
                isInline
                component="a"
                href={consolePodLogsUrl(data.namespace, data.podName, data.container || undefined)}
              >
                Open in console
              </Button>
            </>
          )}
        </div>
      )}

      <pre
        ref={logRef}
        style={{
          flex: 1,
          margin: 0,
          padding: '12px',
          overflow: 'auto',
          fontSize: '12px',
          lineHeight: 1.5,
          fontFamily: 'var(--pf-global--FontFamily--monospace, monospace)',
          backgroundColor: 'var(--integration-bg-dark)',
          color: 'var(--integration-text-primary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {data?.logs || (error ? '' : 'Waiting for logs...')}
      </pre>
    </div>
  );
};

export default FlowLogsTab;
