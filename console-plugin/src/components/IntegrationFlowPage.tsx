import * as React from 'react';

const integrationFlowGVK = {
  group: 'platform.io',
  version: 'v1alpha1',
  kind: 'IntegrationFlow',
};

const IntegrationFlowPage: React.FC = () => {
  const [flows, setFlows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // In production, use @openshift-console/dynamic-plugin-sdk useK8sWatchResource
    // For now, display a placeholder table
    setFlows([
      { name: 'sample-camel-flow', engine: 'CAMEL', phase: 'Running' },
      { name: 'sample-sonataflow', engine: 'SONATAFLOW', phase: 'Building' },
    ]);
    setLoading(false);
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <h1>Integration Flows</h1>
      <p>Real-Time Integration &amp; Orchestration Platform</p>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Name</th>
              <th style={{ padding: '8px' }}>Engine</th>
              <th style={{ padding: '8px' }}>Phase</th>
              <th style={{ padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((flow) => (
              <tr key={flow.name} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>
                  <a href={`/integration-flows/${flow.name}`}>{flow.name}</a>
                </td>
                <td style={{ padding: '8px' }}>{flow.engine}</td>
                <td style={{ padding: '8px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: flow.phase === 'Running' ? '#e6f4ea' : '#fff3e0',
                      color: flow.phase === 'Running' ? '#1b5e20' : '#e65100',
                    }}
                  >
                    {flow.phase}
                  </span>
                </td>
                <td style={{ padding: '8px' }}>
                  <a href={`/integration-flows/${flow.name}`}>Open Designer</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default IntegrationFlowPage;
export { IntegrationFlowPage };
