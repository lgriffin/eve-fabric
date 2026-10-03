import { useState, useEffect } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store.js';
import { useToastStore } from '../../stores/toast-store.js';
import { colors, fontSize, borderRadius, SOURCE_BADGES } from '../../tokens.js';

const sectionHeaderStyle: React.CSSProperties = {
  color: colors.text.secondary,
  fontSize: fontSize.xs,
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
  borderBottom: `1px solid ${colors.surface.overlay}`,
  fontSize: fontSize.md,
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
              color: colors.text.muted,
              cursor: 'pointer',
              padding: 0,
              fontSize: fontSize.xs,
              width: 12,
            }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span style={{ width: 12 }} />}
        <span style={{ color: colors.text.primary }}>{node.id as string}</span>
        <span style={{ color: colors.text.dim, fontSize: '9px' }}>v{node.version as string}</span>
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

/** What the selected step is: its capability, its ports and, for a composite, what it is made of. */
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
      .catch(() => {
        setDepTree(null);
        useToastStore
          .getState()
          .addToast('warning', 'Dependencies', 'Failed to load dependency tree');
      });
  }, [node?.data.capabilityId, node?.data.source, node]);

  if (!node) return null;

  const { data } = node;
  const badge = SOURCE_BADGES[data.source] ?? {
    color: colors.source.fallback,
    label: data.source || '?',
  };

  return (
    <div
      style={{
        width: 280,
        height: '100%',
        background: colors.surface.raised,
        borderLeft: `1px solid ${colors.surface.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '12px 12px 10px',
          borderBottom: `1px solid ${colors.surface.border}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: colors.text.primary, fontWeight: 700, fontSize: fontSize.lg }}>
            {data.label}
          </span>
          <span
            style={{
              background: badge.color,
              color: colors.surface.raised,
              padding: '2px 8px',
              borderRadius: borderRadius.md,
              fontSize: fontSize.xs,
              fontWeight: 700,
            }}
          >
            {badge.label}
          </span>
        </div>
        <div style={{ color: colors.text.muted, fontSize: fontSize.sm, marginTop: 4 }}>
          {data.capabilityId}@{data.capabilityVersion}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        <div style={sectionHeaderStyle}>INPUTS</div>
        {data.inputs.length === 0 && (
          <div style={{ color: colors.text.disabled, fontSize: fontSize.sm }}>No inputs</div>
        )}
        {data.inputs.map((input) => (
          <div key={input.name} style={portRowStyle}>
            <div>
              <span style={{ color: colors.text.primary }}>{input.name}</span>
              {input.required && (
                <span style={{ color: colors.status.error, marginLeft: 4 }}>*</span>
              )}
            </div>
            <span style={{ color: colors.text.dim, fontSize: fontSize.xs }}>
              {input.semanticType}
            </span>
          </div>
        ))}

        <div style={sectionHeaderStyle}>OUTPUTS</div>
        {data.outputs.length === 0 && (
          <div style={{ color: colors.text.disabled, fontSize: fontSize.sm }}>No outputs</div>
        )}
        {data.outputs.map((output) => (
          <div key={output.name} style={portRowStyle}>
            <span style={{ color: colors.text.primary }}>{output.name}</span>
            <span style={{ color: colors.text.dim, fontSize: fontSize.xs }}>
              {output.semanticType}
            </span>
          </div>
        ))}

        {data.source === 'COMPOSITE' && (
          <>
            <div style={sectionHeaderStyle}>DEPENDENCIES</div>
            {depTree ? (
              <DependencyTree node={depTree} />
            ) : (
              <div style={{ color: colors.text.disabled, fontSize: fontSize.sm }}>Loading...</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
