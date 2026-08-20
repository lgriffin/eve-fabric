import { useMemo } from 'react';
import { ReactFlow, type Node, type Edge, Background, Controls, MiniMap } from '@xyflow/react';
import type { DrilldownEntry } from '../../stores/pipeline-store.js';
import { colors, borderRadius } from '../../tokens.js';

interface CompositeOverlayProps {
  entry: DrilldownEntry;
  onClose: () => void;
  onDrillDown: (entry: DrilldownEntry) => void;
}

export function CompositeOverlay({
  entry,
  onClose,
  onDrillDown: _onDrillDown,
}: CompositeOverlayProps) {
  const { nodes, edges } = useMemo(() => {
    if (!entry.pipelineDef) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    const flowNodes: Node[] = entry.pipelineDef.nodes.map((node, i) => ({
      id: node.id,
      type: 'default',
      position: { x: 100 + (i % 3) * 250, y: 100 + Math.floor(i / 3) * 150 },
      data: {
        label: node.capability.version
          ? (node.capability.id as string) + ' v' + (node.capability.version as string)
          : (node.capability.id as string),
      },
      style: {
        background: colors.surface.overlay,
        color: colors.text.primary,
        border: `1px solid ${colors.text.disabled}`,
        borderRadius: borderRadius.lg,
        padding: 8,
        fontSize: '11px',
      },
    }));

    const flowEdges: Edge[] = entry.pipelineDef.edges.map((edge, i) => ({
      id: `e-${i}`,
      source: edge.from.split('.')[0]!,
      target: edge.to.split('.')[0]!,
      style: { stroke: colors.text.disabled },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [entry.pipelineDef]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          background: colors.surface.base,
          borderBottom: `1px solid ${colors.surface.borderLight}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: colors.text.primary, fontSize: '13px', fontWeight: 600 }}>
          {entry.capabilityId} v{entry.version}
        </span>
        <button
          onClick={onClose}
          style={{
            background: colors.surface.border,
            border: 'none',
            borderRadius: borderRadius.md,
            padding: '4px 12px',
            color: colors.text.secondary,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
      <div style={{ flex: 1 }}>
        {entry.pipelineDef ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: colors.text.dim,
            }}
          >
            Loading pipeline...
          </div>
        )}
      </div>
    </div>
  );
}
