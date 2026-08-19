import { useCallback } from 'react';
import type { Connection } from '@xyflow/react';
import { usePipelineStore } from '../stores/pipeline-store.js';
import type { CapabilityFlowNode } from '../stores/pipeline-store.js';

export function useConnectionValidator() {
  const nodes = usePipelineStore((s) => s.nodes);

  return useCallback(
    (connection: Connection): boolean => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      const sourceNode = nodes.find((n) => n.id === connection.source) as CapabilityFlowNode | undefined;
      const targetNode = nodes.find((n) => n.id === connection.target) as CapabilityFlowNode | undefined;
      if (!sourceNode || !targetNode) return false;

      if (!connection.sourceHandle || !connection.targetHandle) return true;

      const sourcePort = sourceNode.data.outputs.find((o) => o.name === connection.sourceHandle);
      const targetPort = targetNode.data.inputs.find((i) => i.name === connection.targetHandle);

      if (!sourcePort || !targetPort) return false;

      return sourcePort.semanticType === targetPort.semanticType;
    },
    [nodes],
  );
}
