import { useMemo } from 'react';
import { usePipelineStore } from '../stores/pipeline-store.js';

interface FlowContext {
  availableOutputTypes: string[];
  existingCapabilityIds: string[];
}

export function useFlowContext(): FlowContext {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);

  return useMemo(() => {
    const existingCapabilityIds = nodes.map((n) => n.data.capabilityId);

    const connectedSourcePorts = new Set(edges.map((e) => `${e.source}.${e.sourceHandle}`));

    const availableOutputTypes: string[] = [];
    for (const node of nodes) {
      for (const output of node.data.outputs) {
        const portKey = `${node.id}.${output.name}`;
        if (!connectedSourcePorts.has(portKey)) {
          availableOutputTypes.push(output.semanticType);
        }
      }
    }

    return {
      availableOutputTypes: [...new Set(availableOutputTypes)],
      existingCapabilityIds: [...new Set(existingCapabilityIds)],
    };
  }, [nodes, edges]);
}
