import * as React from 'react';

import { PROXY_BASE } from '../constants';

interface NodeMetrics {
  nodeId: string;
  clusters: Array<{
    clusterName: string;
    status: 'healthy' | 'error' | 'degraded' | 'unknown';
    latencyP99Ms: number;
    throughputRpm: number;
    errorRate: number;
    activeTraces: number;
  }>;
}

interface TelemetryEvent {
  schemaVersion: string;
  flowId: string;
  timestamp: string;
  nodes: NodeMetrics[];
}

interface Props {
  flowId: string;
}

const TelemetryOverlay: React.FC<Props> = ({ flowId }) => {
  const [telemetry, setTelemetry] = React.useState<TelemetryEvent | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const esRef = React.useRef<EventSource | null>(null);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = React.useRef(0);

  const connect = React.useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const url = `${PROXY_BASE}/api/telemetry/stream/${flowId}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retryCountRef.current = 0;
      setRetryCount(0);
    };

    es.onmessage = (event) => {
      try {
        const data: TelemetryEvent = JSON.parse(event.data);
        setTelemetry(data);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      setConnected(false);
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
      retryCountRef.current += 1;
      setRetryCount(retryCountRef.current);
      retryTimerRef.current = setTimeout(connect, delay);
    };
  }, [flowId]);

  React.useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [flowId]); // only reconnect on flowId change, not on retryCount

  const statusColor = (s: string) => {
    switch (s) {
      case 'healthy': return '#3e8635';
      case 'degraded': return '#f0ab00';
      case 'error': return '#c9190b';
      default: return '#6a6e73';
    }
  };

  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        Node Telemetry
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
          backgroundColor: connected ? '#3e8635' : '#c9190b',
        }} />
      </div>
      {!telemetry ? (
        <div className="co-help-text" style={{ fontSize: '12px' }}>
          {connected ? 'Waiting for telemetry data...' : `Connecting... (retry ${retryCount})`}
        </div>
      ) : (
        <div style={{ fontSize: '12px' }}>
          {telemetry.nodes.map(node => {
            const primary = node.clusters[0];
            if (!primary) return null;
            return (
              <div key={node.nodeId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 0', borderBottom: '1px solid var(--pf-global--BorderColor--100, #d2d2d2)',
              }}>
                <span style={{ color: 'var(--pf-global--Color--100, #151515)' }}>{node.nodeId}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                    {primary.latencyP99Ms.toFixed(0)}ms
                  </span>
                  <span style={{ color: 'var(--pf-global--Color--200, #6a6e73)' }}>
                    {primary.throughputRpm.toFixed(0)}rpm
                  </span>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
                    backgroundColor: statusColor(primary.status),
                  }} />
                </div>
              </div>
            );
          })}
          <div className="co-help-text" style={{ marginTop: '4px', fontSize: '11px' }}>
            Updated: {new Date(telemetry.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default TelemetryOverlay;
export { TelemetryOverlay };
