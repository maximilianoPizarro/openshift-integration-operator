import * as React from 'react';
import KaotoCanvasEmbed from './KaotoCanvasEmbed';
import TelemetryOverlay from './TelemetryOverlay';

interface FlowDesignerPageProps {
  match?: { params: { name: string } };
}

const FlowDesignerPage: React.FC<FlowDesignerPageProps> = ({ match }) => {
  const flowName = match?.params?.name || 'unknown';

  return (
    <div style={{ padding: '24px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Flow: {flowName}</h1>
          <p style={{ color: '#666', margin: '4px 0 0 0' }}>Visual Integration Designer</p>
        </div>
        <div>
          <a href="/integration-flows" style={{ marginRight: '16px' }}>Back to Flows</a>
          <button style={{ padding: '8px 16px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Save &amp; Deploy
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '16px' }}>
        <div style={{ flex: 3, border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
          <KaotoCanvasEmbed flowName={flowName} />
        </div>
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '16px' }}>
          <TelemetryOverlay flowId={flowName} />
        </div>
      </div>
    </div>
  );
};

export default FlowDesignerPage;
export { FlowDesignerPage };
