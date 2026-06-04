import * as React from 'react';

interface FlowNode {
  id: string;
  type: string;
  label: string;
  detail: string;
}

interface FlowVisualizerProps {
  design: string;
  engine: string;
  onNodeClick?: (node: FlowNode) => void;
}

const nodeColors: Record<string, { bg: string; border: string; icon: string }> = {
  from:      { bg: 'rgba(47,158,68,0.2)', border: '#3e8635', icon: '\u25B6' },
  to:        { bg: 'rgba(56,139,253,0.2)', border: '#2b9af3', icon: '\u27A1' },
  log:       { bg: 'rgba(137,87,229,0.15)', border: '#8476d1', icon: '\u270E' },
  marshal:   { bg: 'rgba(240,171,0,0.15)', border: '#f0ab00', icon: '\u2699' },
  unmarshal: { bg: 'rgba(240,171,0,0.15)', border: '#f0ab00', icon: '\u2699' },
  process:   { bg: 'rgba(201,25,11,0.15)', border: '#c9190b', icon: '\u2699' },
  filter:    { bg: 'rgba(240,171,0,0.15)', border: '#f0ab00', icon: '\u29D6' },
  choice:    { bg: 'rgba(240,171,0,0.2)', border: '#f0ab00', icon: '\u2B29' },
  bean:      { bg: 'rgba(201,25,11,0.15)', border: '#c9190b', icon: '\u2616' },
  transform: { bg: 'rgba(56,139,253,0.15)', border: '#2b9af3', icon: '\u21C4' },
  setHeader: { bg: 'rgba(137,87,229,0.15)', border: '#8476d1', icon: '\u2630' },
  setBody:   { bg: 'rgba(137,87,229,0.15)', border: '#8476d1', icon: '\u2630' },
  state:     { bg: 'rgba(56,139,253,0.15)', border: '#2b9af3', icon: '\u25CE' },
  start:     { bg: 'rgba(47,158,68,0.2)', border: '#3e8635', icon: '\u25B6' },
  end:       { bg: 'rgba(201,25,11,0.15)', border: '#c9190b', icon: '\u25A0' },
  default:   { bg: 'rgba(106,110,115,0.15)', border: '#6a6e73', icon: '\u2B22' },
};

function parseCamelNodes(yaml: string): FlowNode[] {
  const nodes: FlowNode[] = [];
  const lines = yaml.split('\n');

  let inFrom = false;
  let inSteps = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('from:')) { inFrom = true; continue; }

    if (inFrom && trimmed.startsWith('uri:')) {
      const uri = trimmed.replace(/^uri:\s*["']?/, '').replace(/["']?\s*$/, '');
      nodes.push({ id: `from-${nodes.length}`, type: 'from', label: 'From', detail: uri });
      inFrom = false;
      continue;
    }

    if (trimmed === 'steps:') { inSteps = true; continue; }

    if (inSteps) {
      const stepMatch = trimmed.match(/^-\s+(\w+):/);
      if (stepMatch) {
        const stepType = stepMatch[1];
        nodes.push({ id: `step-${nodes.length}`, type: stepType, label: stepType.charAt(0).toUpperCase() + stepType.slice(1), detail: '' });
        continue;
      }

      if (nodes.length > 0 && !nodes[nodes.length - 1].detail) {
        const msgMatch = trimmed.match(/^(?:message|uri|method|expression|name):\s*["']?(.+?)["']?\s*$/);
        if (msgMatch) {
          nodes[nodes.length - 1].detail = msgMatch[1];
        }
        const jsonMatch = trimmed.match(/^json:\s*\{/);
        if (jsonMatch) {
          nodes[nodes.length - 1].detail = 'JSON';
        }
      }
    }
  }
  return nodes;
}

function parseSonataFlowNodes(yaml: string): FlowNode[] {
  const nodes: FlowNode[] = [];
  const lines = yaml.split('\n');

  let startState = '';
  let currentState = '';
  let currentTransition = '';

  for (const line of lines) {
    const trimmed = line.trim();
    const startMatch = trimmed.match(/^start:\s*(.+)/);
    if (startMatch) { startState = startMatch[1]; continue; }

    const nameMatch = trimmed.match(/^-\s*name:\s*(.+)/);
    if (nameMatch) {
      currentState = nameMatch[1];
      continue;
    }

    const typeMatch = trimmed.match(/^type:\s*(.+)/);
    if (typeMatch && currentState) {
      nodes.push({ id: `state-${nodes.length}`, type: 'state', label: currentState, detail: typeMatch[1] });
      currentState = '';
    }

    if (trimmed.match(/end:\s*true/)) {
      if (nodes.length > 0) nodes[nodes.length - 1].type = 'end';
    }
  }

  if (startState && nodes.length > 0) {
    const startNode = nodes.find(n => n.label === startState);
    if (startNode) startNode.type = 'start';
  }

  return nodes;
}

const FlowVisualizer: React.FC<FlowVisualizerProps> = ({ design, engine, onNodeClick }) => {
  const nodes = React.useMemo(() => {
    if (!design) return [];
    return engine === 'SONATAFLOW' ? parseSonataFlowNodes(design) : parseCamelNodes(design);
  }, [design, engine]);

  if (nodes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--pf-global--Color--200, #8a8d90)' }}>
        <p>No flow nodes detected. Edit the YAML design to see the visual flow.</p>
      </div>
    );
  }

  const nodeW = 220;
  const nodeH = 70;
  const gapY = 24;
  const padX = 40;
  const padY = 30;
  const totalH = nodes.length * (nodeH + gapY) - gapY + padY * 2;
  const totalW = nodeW + padX * 2;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
      <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
        {nodes.map((node, i) => {
          const x = padX;
          const y = padY + i * (nodeH + gapY);
          const colors = nodeColors[node.type] || nodeColors.default;

          return (
            <g key={node.id} style={{ cursor: onNodeClick ? 'pointer' : 'default' }} onClick={() => onNodeClick?.(node)}>
              {/* Connector line to next node */}
              {i < nodes.length - 1 && (
                <>
                  <line
                    x1={x + nodeW / 2} y1={y + nodeH}
                    x2={x + nodeW / 2} y2={y + nodeH + gapY}
                    stroke="#4a4d52" strokeWidth="2"
                  />
                  <polygon
                    points={`${x + nodeW / 2 - 5},${y + nodeH + gapY - 8} ${x + nodeW / 2 + 5},${y + nodeH + gapY - 8} ${x + nodeW / 2},${y + nodeH + gapY}`}
                    fill="#4a4d52"
                  />
                </>
              )}

              {/* Node rectangle */}
              <rect x={x} y={y} width={nodeW} height={nodeH} rx="8" ry="8"
                fill={colors.bg} stroke={colors.border} strokeWidth="2" />

              {/* Icon circle */}
              <circle cx={x + 28} cy={y + nodeH / 2} r="16" fill={colors.border} opacity="0.3" />
              <text x={x + 28} y={y + nodeH / 2 + 1} textAnchor="middle" dominantBaseline="central"
                fill={colors.border} fontSize="14" fontWeight="bold">{colors.icon}</text>

              {/* Label */}
              <text x={x + 54} y={y + 26} fill="#e0e0e0" fontSize="14" fontWeight="600">
                {node.label}
              </text>

              {/* Detail */}
              {node.detail && (
                <text x={x + 54} y={y + 48} fill="#8a8d90" fontSize="11">
                  {node.detail.length > 28 ? node.detail.substring(0, 28) + '...' : node.detail}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default FlowVisualizer;
export { FlowVisualizer };
