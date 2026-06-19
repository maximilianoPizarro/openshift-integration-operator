import * as React from 'react';

/* ─── Types ──────────────────────────────────────────────────── */

interface FlowNode {
  id: string;
  type: string;
  label: string;
  detail: string;
  yamlLineStart: number;
  yamlLineEnd: number;
  children?: FlowNode[];  // branches (choice when/otherwise)
}

interface FlowVisualizerProps {
  design: string;
  engine: string;
  onNodeClick?: (node: FlowNode) => void;
}

/* ─── Colors ─────────────────────────────────────────────────── */

const nodeColors: Record<string, { bg: string; border: string; icon: string }> = {
  from:         { bg: 'rgba(47,158,68,0.2)',  border: '#3e8635', icon: '\u25B6' },
  to:           { bg: 'rgba(56,139,253,0.2)', border: '#2b9af3', icon: '\u27A1' },
  log:          { bg: 'rgba(137,87,229,0.15)',border: '#8476d1', icon: '\u270E' },
  marshal:      { bg: 'rgba(240,171,0,0.15)', border: '#f0ab00', icon: '\u2699' },
  unmarshal:    { bg: 'rgba(240,171,0,0.15)', border: '#f0ab00', icon: '\u2699' },
  process:      { bg: 'rgba(201,25,11,0.15)', border: '#c9190b', icon: '\u2699' },
  filter:       { bg: 'rgba(240,171,0,0.15)', border: '#f0ab00', icon: '\u29D6' },
  choice:       { bg: 'rgba(240,171,0,0.25)', border: '#f0ab00', icon: '\u2B29' },
  when:         { bg: 'rgba(56,139,253,0.15)',border: '#2b9af3', icon: '\u2753' },
  otherwise:    { bg: 'rgba(201,25,11,0.15)', border: '#c9190b', icon: '\u2026' },
  bean:         { bg: 'rgba(201,25,11,0.15)', border: '#c9190b', icon: '\u2616' },
  transform:    { bg: 'rgba(56,139,253,0.15)',border: '#2b9af3', icon: '\u21C4' },
  setHeader:    { bg: 'rgba(137,87,229,0.15)',border: '#8476d1', icon: '\u2630' },
  setBody:      { bg: 'rgba(137,87,229,0.15)',border: '#8476d1', icon: '\u2630' },
  multicast:    { bg: 'rgba(0,149,150,0.2)',  border: '#009596', icon: '\u2234' },
  split:        { bg: 'rgba(0,149,150,0.2)',  border: '#009596', icon: '\u2702' },
  aggregate:    { bg: 'rgba(0,149,150,0.2)',  border: '#009596', icon: '\u2A01' },
  recipientList:{ bg: 'rgba(0,149,150,0.2)',  border: '#009596', icon: '\u2709' },
  doTry:        { bg: 'rgba(47,158,68,0.15)', border: '#3e8635', icon: '\u2714' },
  doCatch:      { bg: 'rgba(201,25,11,0.15)', border: '#c9190b', icon: '\u2718' },
  doFinally:    { bg: 'rgba(137,87,229,0.15)',border: '#8476d1', icon: '\u2731' },
  onException:  { bg: 'rgba(201,25,11,0.15)', border: '#c9190b', icon: '\u26A0' },
  deadLetterChannel: { bg: 'rgba(201,25,11,0.2)', border: '#c9190b', icon: '\u2620' },
  simple:       { bg: 'rgba(240,171,0,0.15)', border: '#f0ab00', icon: '\u03BB' },
  state:        { bg: 'rgba(56,139,253,0.15)',border: '#2b9af3', icon: '\u25CE' },
  start:        { bg: 'rgba(47,158,68,0.2)',  border: '#3e8635', icon: '\u25B6' },
  end:          { bg: 'rgba(201,25,11,0.15)', border: '#c9190b', icon: '\u25A0' },
  default:      { bg: 'rgba(106,110,115,0.15)',border:'#6a6e73', icon: '\u2B22' },
};

/* ─── Camel YAML Parser with branches ────────────────────────── */

function parseCamelNodes(yaml: string): FlowNode[] {
  const nodes: FlowNode[] = [];
  const lines = yaml.split('\n');

  interface ParseCtx { indent: number; nodes: FlowNode[] }
  const ctxStack: ParseCtx[] = [{ indent: -1, nodes }];

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const indent = raw.length - raw.trimStart().length;

    if (!trimmed || trimmed.startsWith('#')) { i++; continue; }

    // from:
    if (trimmed.startsWith('from:')) {
      const node: FlowNode = { id: `from-${i}`, type: 'from', label: 'From', detail: '', yamlLineStart: i, yamlLineEnd: i };
      // look ahead for uri
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const t = lines[j].trim();
        if (t.startsWith('uri:')) {
          node.detail = t.replace(/^uri:\s*["']?/, '').replace(/["']?\s*$/, '');
          node.yamlLineEnd = j;
          break;
        }
      }
      nodes.push(node);
      i++;
      continue;
    }

    // step match: "- stepType:" or "- stepType"
    const stepMatch = trimmed.match(/^-\s+(\w+):?\s*$/);
    if (stepMatch) {
      const stepType = stepMatch[1];
      const lineStart = i;

      // find extent of this step (lines with deeper indent)
      let lineEnd = i;
      for (let j = i + 1; j < lines.length; j++) {
        const jRaw = lines[j];
        const jTrimmed = jRaw.trim();
        if (!jTrimmed) { lineEnd = j; continue; }
        const jIndent = jRaw.length - jRaw.trimStart().length;
        if (jIndent <= indent && jTrimmed.startsWith('-')) break;
        if (jIndent <= indent && !jTrimmed.startsWith('-')) break;
        lineEnd = j;
      }

      const node: FlowNode = {
        id: `step-${i}`, type: stepType,
        label: stepType.charAt(0).toUpperCase() + stepType.slice(1),
        detail: '', yamlLineStart: lineStart, yamlLineEnd: lineEnd
      };

      // extract detail from sub-lines
      for (let j = i + 1; j <= lineEnd; j++) {
        const sub = lines[j].trim();
        const detailMatch = sub.match(/^(?:message|uri|method|expression|name|simple|constant|deadLetterUri):\s*["']?(.+?)["']?\s*$/);
        if (detailMatch && !node.detail) {
          node.detail = detailMatch[1];
        }
      }

      // parse branches for choice/multicast/doTry
      if (stepType === 'choice' || stepType === 'multicast' || stepType === 'doTry') {
        node.children = parseBranches(lines, i + 1, lineEnd, stepType);
      }

      nodes.push(node);
      i = lineEnd + 1;
      continue;
    }

    i++;
  }
  return nodes;
}

function parseBranches(lines: string[], start: number, end: number, parentType: string): FlowNode[] {
  const branches: FlowNode[] = [];
  for (let i = start; i <= end; i++) {
    const trimmed = lines[i].trim();
    // choice branches: when, otherwise
    if (parentType === 'choice') {
      if (trimmed.startsWith('- when:') || trimmed === '- when:') {
        const branch = parseBranchNode(lines, i, end, 'when', 'When');
        branches.push(branch);
      }
      if (trimmed.startsWith('- otherwise:') || trimmed === '- otherwise:' || trimmed === 'otherwise:') {
        const branch = parseBranchNode(lines, i, end, 'otherwise', 'Otherwise');
        branches.push(branch);
      }
    }
    // multicast branches are to: nodes
    if (parentType === 'multicast' && trimmed.startsWith('- to:')) {
      const detail = trimmed.replace(/^-\s+to:\s*["']?/, '').replace(/["']?\s*$/, '');
      branches.push({ id: `branch-${i}`, type: 'to', label: 'To', detail, yamlLineStart: i, yamlLineEnd: i });
    }
    // doTry branches: doCatch, doFinally
    if (parentType === 'doTry') {
      if (trimmed.startsWith('- doCatch:') || trimmed === 'doCatch:') {
        branches.push(parseBranchNode(lines, i, end, 'doCatch', 'Catch'));
      }
      if (trimmed.startsWith('- doFinally:') || trimmed === 'doFinally:') {
        branches.push(parseBranchNode(lines, i, end, 'doFinally', 'Finally'));
      }
    }
  }
  return branches;
}

function parseBranchNode(lines: string[], start: number, maxEnd: number, type: string, label: string): FlowNode {
  // find extent
  const indent = lines[start].length - lines[start].trimStart().length;
  let lineEnd = start;
  for (let j = start + 1; j <= maxEnd; j++) {
    const t = lines[j].trim();
    if (!t) continue;
    const jIndent = lines[j].length - lines[j].trimStart().length;
    if (jIndent <= indent && (t.startsWith('-') || t.match(/^\w+:/))) break;
    lineEnd = j;
  }
  let detail = '';
  for (let j = start; j <= lineEnd; j++) {
    const sub = lines[j].trim();
    const m = sub.match(/^(?:simple|expression|condition|jsonpath):\s*["']?(.+?)["']?\s*$/);
    if (m) { detail = m[1]; break; }
  }
  return { id: `branch-${start}`, type, label: detail ? `${label}: ${detail}` : label, detail, yamlLineStart: start, yamlLineEnd: lineEnd };
}

/* ─── SonataFlow YAML Parser ─────────────────────────────────── */

function parseSonataFlowNodes(yaml: string): FlowNode[] {
  const nodes: FlowNode[] = [];
  const lines = yaml.split('\n');
  let startState = '';
  let currentState = '';
  let stateLineStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const startMatch = trimmed.match(/^start:\s*(.+)/);
    if (startMatch) { startState = startMatch[1]; continue; }

    const nameMatch = trimmed.match(/^-\s*name:\s*(.+)/);
    if (nameMatch) {
      if (currentState && stateLineStart >= 0) {
        const prev = nodes[nodes.length - 1];
        if (prev) prev.yamlLineEnd = i - 1;
      }
      currentState = nameMatch[1];
      stateLineStart = i;
      continue;
    }

    const typeMatch = trimmed.match(/^type:\s*(.+)/);
    if (typeMatch && currentState) {
      nodes.push({ id: `state-${nodes.length}`, type: 'state', label: currentState, detail: typeMatch[1], yamlLineStart: stateLineStart, yamlLineEnd: i });
      currentState = '';
    }

    if (trimmed.match(/end:\s*true/) && nodes.length > 0) {
      nodes[nodes.length - 1].type = 'end';
      nodes[nodes.length - 1].yamlLineEnd = i;
    }
  }

  if (nodes.length > 0) nodes[nodes.length - 1].yamlLineEnd = lines.length - 1;

  if (startState && nodes.length > 0) {
    const sn = nodes.find(n => n.label === startState);
    if (sn) sn.type = 'start';
  }
  return nodes;
}

/* ─── Layout engine ──────────────────────────────────────────── */

const NODE_W = 200;
const NODE_H = 60;
const GAP_Y = 30;
const BRANCH_GAP_X = 30;
const PAD_X = 40;
const PAD_Y = 30;

interface LayoutNode {
  node: FlowNode;
  x: number;
  y: number;
  w: number;
  h: number;
  branchLayouts?: LayoutNode[][];
  totalBlockH: number;
}

function layoutNodes(nodes: FlowNode[]): { layouts: LayoutNode[]; totalW: number; totalH: number } {
  let y = PAD_Y;
  const layouts: LayoutNode[] = [];
  let maxW = NODE_W + PAD_X * 2;

  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      // branching node
      const branchLayouts: LayoutNode[][] = [];
      let branchTotalW = 0;
      let branchMaxH = 0;

      for (const child of node.children) {
        const childLayout: LayoutNode = {
          node: child, x: 0, y: 0, w: NODE_W, h: NODE_H, totalBlockH: NODE_H,
        };
        branchLayouts.push([childLayout]);
        branchTotalW += NODE_W;
        branchMaxH = Math.max(branchMaxH, NODE_H);
      }
      branchTotalW += (node.children.length - 1) * BRANCH_GAP_X;

      const layout: LayoutNode = {
        node, x: 0, y, w: NODE_W, h: NODE_H,
        branchLayouts,
        totalBlockH: NODE_H + GAP_Y + branchMaxH + GAP_Y,
      };

      maxW = Math.max(maxW, branchTotalW + PAD_X * 2);
      layouts.push(layout);
      y += layout.totalBlockH;
    } else {
      layouts.push({ node, x: 0, y, w: NODE_W, h: NODE_H, totalBlockH: NODE_H + GAP_Y });
      y += NODE_H + GAP_Y;
    }
  }

  const totalW = Math.max(maxW, NODE_W + PAD_X * 2);
  // center main nodes
  for (const l of layouts) {
    l.x = totalW / 2 - NODE_W / 2;

    if (l.branchLayouts) {
      const branchCount = l.branchLayouts.length;
      const totalBranchW = branchCount * NODE_W + (branchCount - 1) * BRANCH_GAP_X;
      let bx = totalW / 2 - totalBranchW / 2;
      const by = l.y + NODE_H + GAP_Y;

      for (const bl of l.branchLayouts) {
        for (const bn of bl) {
          bn.x = bx;
          bn.y = by;
        }
        bx += NODE_W + BRANCH_GAP_X;
      }
    }
  }

  return { layouts, totalW, totalH: y + PAD_Y };
}

/* ─── Rendering ──────────────────────────────────────────────── */

const FlowVisualizer: React.FC<FlowVisualizerProps> = ({ design, engine, onNodeClick }) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const nodes = React.useMemo(() => {
    if (!design) return [];
    return engine === 'SONATAFLOW' ? parseSonataFlowNodes(design) : parseCamelNodes(design);
  }, [design, engine]);

  const { layouts, totalW, totalH } = React.useMemo(() => layoutNodes(nodes), [nodes]);

  const handleClick = (node: FlowNode) => {
    setSelectedId(node.id === selectedId ? null : node.id);
    onNodeClick?.(node);
  };

  if (nodes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--pf-global--Color--200, #8a8d90)' }}>
        <p>No flow nodes detected. Edit the YAML design to see the visual flow.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
      <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#4a4d52" />
          </marker>
        </defs>
        {layouts.map((l, i) => {
          const nextLayout = layouts[i + 1];
          return (
            <g key={l.node.id}>
              {/* Main node */}
              {renderNode(l.node, l.x, l.y, selectedId, handleClick)}

              {/* Branches */}
              {l.branchLayouts && l.branchLayouts.map((bl, bi) => {
                const bn = bl[0];
                const cx = l.x + NODE_W / 2;
                const branchCx = bn.x + NODE_W / 2;
                const splitY = l.y + NODE_H;
                const branchTop = bn.y;

                return (
                  <g key={bn.node.id}>
                    {/* line down from choice diamond, then horizontal to branch, then down to branch node */}
                    <path
                      d={`M ${cx} ${splitY} L ${cx} ${splitY + GAP_Y / 2} L ${branchCx} ${splitY + GAP_Y / 2} L ${branchCx} ${branchTop}`}
                      fill="none" stroke="#4a4d52" strokeWidth="2" markerEnd="url(#arrowhead)"
                    />
                    {renderNode(bn.node, bn.x, bn.y, selectedId, handleClick)}

                    {/* rejoin line from branch bottom to next node or merge point */}
                    {nextLayout && (
                      <path
                        d={`M ${branchCx} ${bn.y + NODE_H} L ${branchCx} ${bn.y + NODE_H + GAP_Y / 2} L ${nextLayout.x + NODE_W / 2} ${bn.y + NODE_H + GAP_Y / 2} L ${nextLayout.x + NODE_W / 2} ${nextLayout.y}`}
                        fill="none" stroke="#4a4d52" strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#arrowhead)"
                      />
                    )}
                  </g>
                );
              })}

              {/* Connector to next node (non-branching) */}
              {!l.branchLayouts && nextLayout && (
                <line
                  x1={l.x + NODE_W / 2} y1={l.y + NODE_H}
                  x2={nextLayout.x + NODE_W / 2} y2={nextLayout.y}
                  stroke="#4a4d52" strokeWidth="2" markerEnd="url(#arrowhead)"
                />
              )}
            </g>
          );
        })}

        {/* YAML line indicator for selected node */}
        {selectedId && (() => {
          const all = layouts.flatMap(l => [l, ...(l.branchLayouts || []).flat()]);
          const sel = all.find(l => l.node.id === selectedId);
          if (!sel) return null;
          return (
            <g>
              <rect x={sel.x - 3} y={sel.y - 3} width={NODE_W + 6} height={NODE_H + 6}
                rx="10" ry="10" fill="none" stroke="#0066cc" strokeWidth="2.5" strokeDasharray="6,3" />
              <rect x={sel.x} y={sel.y + NODE_H + 4} rx="4" ry="4" width={NODE_W} height="18"
                fill="rgba(0,102,204,0.9)" />
              <text x={sel.x + NODE_W / 2} y={sel.y + NODE_H + 16} textAnchor="middle"
                fill="#fff" fontSize="10" fontFamily="monospace">
                YAML lines {sel.node.yamlLineStart + 1}\u2013{sel.node.yamlLineEnd + 1}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
};

function renderNode(
  node: FlowNode, x: number, y: number,
  selectedId: string | null, onClick: (n: FlowNode) => void
): React.ReactElement {
  const colors = nodeColors[node.type] || nodeColors.default;
  const isSelected = node.id === selectedId;
  const isChoice = node.type === 'choice' || node.type === 'multicast' || node.type === 'doTry';

  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onClick(node)}>
      {isChoice ? (
        // Diamond shape for decision nodes
        <g>
          <polygon
            points={`${x + NODE_W / 2},${y} ${x + NODE_W},${y + NODE_H / 2} ${x + NODE_W / 2},${y + NODE_H} ${x},${y + NODE_H / 2}`}
            fill={colors.bg} stroke={isSelected ? '#0066cc' : colors.border} strokeWidth={isSelected ? 3 : 2}
          />
          <text x={x + NODE_W / 2} y={y + NODE_H / 2 - 6} textAnchor="middle" fill="var(--integration-text-primary)" fontSize="13" fontWeight="600">
            {colors.icon} {node.label}
          </text>
          {node.detail && (
            <text x={x + NODE_W / 2} y={y + NODE_H / 2 + 12} textAnchor="middle" fill="#8a8d90" fontSize="10">
              {node.detail.length > 24 ? node.detail.substring(0, 24) + '...' : node.detail}
            </text>
          )}
        </g>
      ) : (
        // Rectangle for regular nodes
        <g>
          <rect x={x} y={y} width={NODE_W} height={NODE_H} rx="8" ry="8"
            fill={colors.bg} stroke={isSelected ? '#0066cc' : colors.border}
            strokeWidth={isSelected ? 3 : 2} />
          <circle cx={x + 24} cy={y + NODE_H / 2} r="14" fill={colors.border} opacity="0.3" />
          <text x={x + 24} y={y + NODE_H / 2 + 1} textAnchor="middle" dominantBaseline="central"
            fill={colors.border} fontSize="13" fontWeight="bold">{colors.icon}</text>
          <text x={x + 46} y={y + 24} fill="var(--integration-text-primary)" fontSize="13" fontWeight="600">
            {node.label.length > 20 ? node.label.substring(0, 20) + '...' : node.label}
          </text>
          {node.detail && (
            <text x={x + 46} y={y + 42} fill="#8a8d90" fontSize="10">
              {node.detail.length > 24 ? node.detail.substring(0, 24) + '...' : node.detail}
            </text>
          )}
        </g>
      )}
    </g>
  );
}

export default FlowVisualizer;
export { FlowVisualizer, FlowNode };
