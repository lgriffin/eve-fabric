import type { PipelineDefinition } from '@eve-fabric/core';
import type { Edge } from '@xyflow/react';
import type { CapabilityFlowNode, CapabilityNodeData } from '../stores/types.js';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;
const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 60;

/** The scaffold the fabric built, as React Flow nodes and edges, before the catalog names them. */
export function pipelineToFlow(definition: PipelineDefinition): {
  nodes: CapabilityFlowNode[];
  edges: Edge[];
} {
  const nodes: CapabilityFlowNode[] = definition.nodes.map((node, index) => ({
    id: node.id,
    type: 'capability',
    position: {
      x: (index % 4) * (NODE_WIDTH + HORIZONTAL_GAP) + 50,
      y: Math.floor(index / 4) * (NODE_HEIGHT + VERTICAL_GAP) + 50,
    },
    data: {
      capabilityId: node.capability.id,
      capabilityVersion: (node.capability.version as string) ?? '1.0.0',
      label: node.id,
      source: '',
      inputs: [],
      outputs: [],
    },
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));

  const edges: Edge[] = definition.edges
    .filter((edge) => {
      const from = parsePortRef(edge.from).nodeId;
      const to = parsePortRef(edge.to).nodeId;
      return nodeIds.has(from) && nodeIds.has(to);
    })
    .map((edge, index) => {
      const fromParts = parsePortRef(edge.from);
      const toParts = parsePortRef(edge.to);

      return {
        id: `e-${index}`,
        source: fromParts.nodeId,
        sourceHandle: fromParts.portName,
        target: toParts.nodeId,
        targetHandle: toParts.portName,
        type: 'default',
      };
    });

  return { nodes, edges };
}

export function enrichNodesWithCatalog(
  nodes: CapabilityFlowNode[],
  catalog: Map<
    string,
    {
      name: string;
      source: string;
      inputs: CapabilityNodeData['inputs'];
      outputs: CapabilityNodeData['outputs'];
    }
  >,
): CapabilityFlowNode[] {
  return nodes.map((node) => {
    const cap = catalog.get(node.data.capabilityId);
    if (!cap) return node;
    return {
      ...node,
      data: {
        ...node.data,
        label: cap.name,
        source: cap.source,
        inputs: cap.inputs,
        outputs: cap.outputs,
      },
    };
  });
}

function parsePortRef(ref: string): { nodeId: string; portName: string } {
  const dotIndex = ref.indexOf('.');
  if (dotIndex === -1) return { nodeId: ref, portName: '' };
  return {
    nodeId: ref.substring(0, dotIndex),
    portName: ref.substring(dotIndex + 1),
  };
}
