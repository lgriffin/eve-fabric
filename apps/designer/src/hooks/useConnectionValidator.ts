import { useCallback } from 'react';
import type { Connection } from '@xyflow/react';
import { usePipelineStore, type BridgingSuggestion } from '../stores/pipeline-store.js';
import { useCatalogStore } from '../stores/catalog-store.js';

export function useConnectionValidator() {
  const nodes = usePipelineStore((s) => s.nodes);
  const capabilities = useCatalogStore((s) => s.capabilities);

  const validate = useCallback(
    (connection: Connection): boolean => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;

      if (!connection.sourceHandle || !connection.targetHandle) return true;

      const sourcePort = sourceNode.data.outputs.find((o) => o.name === connection.sourceHandle);
      const targetPort = targetNode.data.inputs.find((i) => i.name === connection.targetHandle);

      if (!sourcePort || !targetPort) return false;

      return sourcePort.semanticType === targetPort.semanticType;
    },
    [nodes],
  );

  const getBridgingSuggestions = useCallback(
    (connection: Connection): BridgingSuggestion[] => {
      if (!connection.source || !connection.target) return [];
      if (!connection.sourceHandle || !connection.targetHandle) return [];

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return [];

      const sourcePort = sourceNode.data.outputs.find((o) => o.name === connection.sourceHandle);
      const targetPort = targetNode.data.inputs.find((i) => i.name === connection.targetHandle);
      if (!sourcePort || !targetPort) return [];
      if (sourcePort.semanticType === targetPort.semanticType) return [];

      const suggestions: BridgingSuggestion[] = [];
      for (const cap of capabilities) {
        const hasMatchingInput = cap.inputs.some((i) => i.semanticType === sourcePort.semanticType);
        const hasMatchingOutput = cap.outputs.some(
          (o) => o.semanticType === targetPort.semanticType,
        );
        if (hasMatchingInput && hasMatchingOutput) {
          suggestions.push({
            sourceNodeId: connection.source,
            sourcePortName: connection.sourceHandle,
            targetNodeId: connection.target,
            targetPortName: connection.targetHandle,
            suggestedCapabilityId: cap.id,
            suggestedCapabilityName: cap.name,
            sourceType: sourcePort.semanticType,
            targetType: targetPort.semanticType,
          });
        }
      }
      return suggestions;
    },
    [nodes, capabilities],
  );

  return { validate, getBridgingSuggestions };
}
