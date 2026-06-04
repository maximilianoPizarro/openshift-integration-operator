import * as React from 'react';

interface NodeTelemetry {
  nodeId: string;
  status: 'healthy' | 'error' | 'degraded';
  latencyP99: number;
}

interface TelemetryOverlayProps {
  flowId: string;
  operatorBaseUrl?: string;
}

const statusColors: Record<string, string> = {
  healthy: '#4caf50',
  degraded: '#ff9800',
  error: '#f44336',
};

/**
 * Connects to the operator SSE endpoint for real-time node telemetry.
 * Displays per-node status and latency. In the full implementation,
 * this data is also used to color the Kaoto canvas nodes.
 */
const TelemetryOverlay: React.FC<TelemetryOverlayProps> = ({
  flowId,
  operatorBaseUrl = '',
}) => {
  const [telemetry, setTelemetry] = React.useState<Map<string, NodeTelemetry>>(new Map());

  React.useEffect(() => {
    const url = `${operatorBaseUrl}/api/telemetry/stream/${encodeURIComponent(flowId)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data: NodeTelemetry = JSON.parse(event.data);
        setTelemetry((prev) => {
          const next = new Map(prev);
          next.set(data.nodeId, data);
          return next;
        });
      } catch (e) {
        console.error('Failed to parse telemetry event:', e);
      }
    };

    eventSource.onerror = () => {
      console.warn('Telemetry SSE connection error, will retry...');
    };

    return () => eventSource.close();
  }, [flowId, operatorBaseUrl]);

  const entries = Array.from(telemetry.values());

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Node Telemetry</h3>
      <p style={{ fontSize: '12px', color: '#666' }}>Live stream from OTel</p>

      {entries.length === 0 ? (
        <p style={{ color: '#999' }}>Waiting for telemetry data...</p>
      ) : (
        <div>
          {entries.map((node) => (
            <div
              key={node.nodeId}
              style={{
                padding: '8px',
                marginBottom: '8px',
                borderRadius: '4px',
                border: `2px solid ${statusColors[node.status] || '#ccc'}`,
                backgroundColor: `${statusColors[node.status]}11`,
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{node.nodeId}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                <span style={{ color: statusColors[node.status] }}>{node.status.toUpperCase()}</span>
                <span>p99: {node.latencyP99}ms</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TelemetryOverlay;
export { TelemetryOverlay };
