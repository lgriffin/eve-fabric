import { useMemo } from 'react';
import { ReactFlow, type Node, type Edge, Background, Controls, MiniMap } from '@xyflow/react';
import type { DrilldownEntry } from '../../stores/pipeline-store.js';

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
        background: '#2a2a45',
        color: '#e0e0e0',
        border: '1px solid #555',
        borderRadius: 6,
        padding: 8,
        fontSize: '11px',
      },
    }));

    const flowEdges: Edge[] = entry.pipelineDef.edges.map((edge, i) => ({
      id: `e-${i}`,
      source: edge.from.split('.')[0]!,
      target: edge.to.split('.')[0]!,
      style: { stroke: '#555' },
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
          background: '#1a1a2e',
          borderBottom: '1px solid #444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#e0e0e0', fontSize: '13px', fontWeight: 600 }}>
          {entry.capabilityId} v{entry.version}
        </span>
        <button
          onClick={onClose}
          style={{
            background: '#333',
            border: 'none',
            borderRadius: 4,
            padding: '4px 12px',
            color: '#aaa',
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
              color: '#666',
            }}
          >
            Loading pipeline...
          </div>
        )}
      </div>
    </div>
  );
}
