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
      } else if (proxyResp.status === 502 || proxyResp.status === 503) {
        const k8s = await fetchPodLogsViaK8s(flowNamespace, flowName, tailLines, container || undefined);
        json = {
          ...k8s,
          containers: k8s.container ? [k8s.container] : [],
          timestamp: new Date().toISOString(),
          name: flowName,
        } as LogsResponse;
      } else {
        const err = await proxyResp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${proxyResp.status}`);
      }

      if (!json) {
        throw new Error('No log response');
      }

      setData(json);
      setError(null);
      if (!container && json.container) {
        setContainer(json.container);
      }
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [flowName, tailLines, container]);

  React.useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  React.useEffect(() => {
    if (!follow) return undefined;
    const id = setInterval(fetchLogs, 3000);
    return () => clearInterval(id);
  }, [fetchLogs, follow]);

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
          color: 'var(--pf-t--global--text--color--regular, var(--pf-global--Color--100, #e0e0e0))',
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
