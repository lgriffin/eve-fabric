import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDraftStore } from '../../stores/draft-store.js';
import { CapabilityNode } from './CapabilityNode.js';
import { colors } from '../../tokens.js';

const nodeTypes = { capability: CapabilityNode };

/**
 * The canvas is a view of the question's scaffold: the steps the fabric
 * built and how they connect. Nothing is wired by hand here; the question
 * changes only through the moves and holes the draft panel offers.
 */
export function PipelineCanvas() {
  const nodes = useDraftStore((s) => s.nodes);
  const edges = useDraftStore((s) => s.edges);
  const onNodesChange = useDraftStore((s) => s.onNodesChange);
  const setSelectedNode = useDraftStore((s) => s.selectNode);

  // A port read by more than one step is drawn heavier, so the fan-out shows.
  const styledEdges = useMemo(() => {
    const portCounts = new Map<string, number>();
    for (const edge of edges) {
      const key = `${edge.source}::${edge.sourceHandle ?? ''}`;
      portCounts.set(key, (portCounts.get(key) ?? 0) + 1);
    }
    return edges.map((edge) => {
      const key = `${edge.source}::${edge.sourceHandle ?? ''}`;
      if ((portCounts.get(key) ?? 0) > 1) {
        return { ...edge, style: { stroke: colors.source.DERIVED, strokeWidth: 2.5 } };
      }
      return edge;
    });
  }, [edges]);

  return (
    <div style={{ flex: 1, height: '100%' }} data-testid="canvas">
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onNodeClick={(_event, node) => setSelectedNode(node.id)}
        onPaneClick={() => setSelectedNode(null)}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: colors.surface.base }}
      >
        <Background color={colors.surface.border} gap={20} />
        <Controls position="bottom-right" />
        <MiniMap
          nodeColor={colors.accent}
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: colors.surface.raised }}
        />
      </ReactFlow>
    </div>
  );
}
