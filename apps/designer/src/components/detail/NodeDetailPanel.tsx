import { useState, useEffect } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store.js';

const SOURCE_BADGES: Record<string, { color: string; label: string }> = {
  ESI: { color: '#4fc3f7', label: 'ESI' },
  SDE: { color: '#81c784', label: 'SDE' },
  DERIVED: { color: '#ba68c8', label: 'DERIVED' },
  CACHE: { color: '#ffd54f', label: 'CACHE' },
  COMPOSITE: { color: '#ff8a65', label: 'COMPOSITE' },
};

const sectionHeaderStyle: React.CSSProperties = {
  color: '#aaa',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.5px',
  marginBottom: 6,
  marginTop: 14,
};

const portRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  borderBottom: '1px solid #2a2a3a',
  fontSize: '12px',
};

interface DependencyTreeNode {
  id: string;
  version: string;
  source: string;
  children: DependencyTreeNode[];
}

function DependencyTree({ node, depth = 0 }: { node: DependencyTreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div style={{ marginLeft: depth * 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 0',
          fontSize: '11px',
        }}
      >
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: 0,
              fontSize: '10px',
              width: 12,
            }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span style={{ width: 12 }} />}
        <span style={{ color: '#e0e0e0' }}>{node.id as string}</span>
        <span style={{ color: '#666', fontSize: '9px' }}>v{node.version as string}</span>
      </div>
      {expanded &&
        node.children.map((child, i) => (
          <DependencyTree
            key={`${child.id as string}-${String(i)}`}
            node={child}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export function NodeDetailPanel() {
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const nodes = usePipelineStore((s) => s.nodes);

  const node = nodes.find((n) => n.id === selectedNodeId);

  const [depTree, setDepTree] = useState<DependencyTreeNode | null>(null);

  useEffect(() => {
    if (!node || node.data.source !== 'COMPOSITE') {
      setDepTree(null);
      return;
    }
    fetch(`/api/registry/${node.data.capabilityId}/dependencies`)
      .then((res) => (res.ok ? (res.json() as Promise<DependencyTreeNode>) : null))
      .then((data) => setDepTree(data))
      .catch(() => setDepTree(null));
  }, [node?.data.capabilityId, node?.data.source, node]);

  if (!node) return null;

  const { data } = node;
  const badge = SOURCE_BADGES[data.source] ?? { color: '#9e9e9e', label: data.source || '?' };

  return (
    <div
      style={{
        width: 280,
        height: '100%',
        background: '#1e1e2e',
        borderLeft: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '12px 12px 10px',
          borderBottom: '1px solid #333',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e0e0e0', fontWeight: 700, fontSize: '14px' }}>{data.label}</span>
          <span
            style={{
              background: badge.color,
              color: '#1e1e2e',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            {badge.label}
          </span>
        </div>
        <div style={{ color: '#888', fontSize: '11px', marginTop: 4 }}>
          {data.capabilityId}@{data.capabilityVersion}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        <div style={sectionHeaderStyle}>INPUTS</div>
        {data.inputs.length === 0 && (
          <div style={{ color: '#555', fontSize: '11px' }}>No inputs</div>
        )}
        {data.inputs.map((input) => (
          <div key={input.name} style={portRowStyle}>
            <div>
              <span style={{ color: '#e0e0e0' }}>{input.name}</span>
              {input.required && <span style={{ color: '#ef5350', marginLeft: 4 }}>*</span>}
            </div>
            <span style={{ color: '#777', fontSize: '10px' }}>{input.semanticType}</span>
          </div>
        ))}

        <div style={sectionHeaderStyle}>OUTPUTS</div>
        {data.outputs.length === 0 && (
          <div style={{ color: '#555', fontSize: '11px' }}>No outputs</div>
        )}
        {data.outputs.map((output) => (
          <div key={output.name} style={portRowStyle}>
            <span style={{ color: '#e0e0e0' }}>{output.name}</span>
            <span style={{ color: '#777', fontSize: '10px' }}>{output.semanticType}</span>
          </div>
        ))}

        <div style={sectionHeaderStyle}>AUTHENTICATION</div>
        <div style={{ color: '#555', fontSize: '11px' }}>No authentication required</div>

        <div style={sectionHeaderStyle}>CACHE POLICY</div>
        <div style={{ color: '#555', fontSize: '11px' }}>Default policy</div>

        <div style={sectionHeaderStyle}>COST ESTIMATE</div>
        <div style={{ color: '#555', fontSize: '11px' }}>~100ms estimated latency</div>

        {data.source === 'COMPOSITE' && (
          <>
            <div style={sectionHeaderStyle}>DEPENDENCIES</div>
            {depTree ? (
              <DependencyTree node={depTree} />
            ) : (
              <div style={{ color: '#555', fontSize: '11px' }}>Loading...</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
