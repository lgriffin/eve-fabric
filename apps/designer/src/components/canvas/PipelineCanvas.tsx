import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { usePipelineStore } from '../../stores/pipeline-store.js';
import { CapabilityNode } from './CapabilityNode.js';
import { colors } from '../../tokens.js';

const nodeTypes = { capability: CapabilityNode };

/**
 * The canvas is a view of the question's scaffold: the steps the fabric
 * built and how they connect. Nothing is wired by hand here; the question
 * changes only through the moves and holes the draft panel offers.
 */
export function PipelineCanvas() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const onNodesChange = usePipelineStore((s) => s.onNodesChange);
  const setSelectedNode = usePipelineStore((s) => s.setSelectedNode);
  const executionSession = usePipelineStore((s) => s.executionSession);

  const nodeExecutionStates = usePipelineStore((s) => s.nodeExecutionStates);

  const styledEdges = useMemo(() => {
    const portCounts = new Map<string, number>();
    for (const edge of edges) {
      const key = `${edge.source}::${edge.sourceHandle ?? ''}`;
      portCounts.set(key, (portCounts.get(key) ?? 0) + 1);
    }

    return edges.map((edge) => {
      const key = `${edge.source}::${edge.sourceHandle ?? ''}`;
      const isFanOut = (portCounts.get(key) ?? 0) > 1;

      if (executionSession?.status === 'running') {
        const statuses = executionSession.stepStatuses;
        const sourceState = statuses[edge.source];
        const targetState = statuses[edge.target];
        const isActive =
          sourceState === 'executing' || sourceState === 'completed' || targetState === 'executing';
        if (isActive) {
          return {
            ...edge,
            animated: true,
            style: { stroke: colors.status.info, strokeWidth: isFanOut ? 3 : 2 },
          };
        }
      }

      const sourceSuccess =
        nodeExecutionStates[edge.source]?.status === 'success' ||
        executionSession?.stepStatuses[edge.source] === 'completed';
      const targetSuccess =
        nodeExecutionStates[edge.target]?.status === 'success' ||
        executionSession?.stepStatuses[edge.target] === 'completed';

      if (sourceSuccess && targetSuccess) {
        return {
          ...edge,
          animated: true,
          style: { stroke: colors.status.successLight, strokeWidth: isFanOut ? 3 : 2 },
        };
      }
      if (sourceSuccess) {
        return {
          ...edge,
          animated: true,
          style: { stroke: colors.status.info, strokeWidth: isFanOut ? 2.5 : 1.5 },
        };
      }

      if (isFanOut) {
        return { ...edge, style: { stroke: colors.source.DERIVED, strokeWidth: 2.5 } };
      }

      return edge;
    });
  }, [edges, executionSession, nodeExecutionStates]);

  return (
    <div style={{ flex: 1, height: '100%' }}>
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
