import type {
  PipelineDefinition,
  PipelineNode,
  PipelineEdge,
  PipelineInput,
  PipelineOutput,
} from '@eve-fabric/domain';
import type { Edge } from '@xyflow/react';
import type { CapabilityFlowNode, CapabilityNodeData } from '../stores/pipeline-store.js';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;
const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 60;

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
      capabilityVersion: (node.capability.version as number) ?? 1,
      label: node.id,
      source: '',
      inputs: [],
      outputs: [],
    },
  }));

  const edges: Edge[] = definition.edges.map((edge, index) => {
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

export function flowToPipeline(
  nodes: CapabilityFlowNode[],
  edges: Edge[],
  meta: { id: string; name: string; version: number; description?: string },
  pipelineInputs: PipelineInput[],
  pipelineOutputs: PipelineOutput[],
): PipelineDefinition {
  const pipelineNodes: PipelineNode[] = nodes.map((node) => ({
    id: node.id,
    capability: {
      id: node.data.capabilityId as PipelineNode['capability']['id'],
      version: node.data.capabilityVersion as PipelineNode['capability']['version'],
    },
  }));

  const pipelineEdges: PipelineEdge[] = edges.map((edge) => ({
    from: edge.sourceHandle ? `${edge.source}.${edge.sourceHandle}` : edge.source,
    to: edge.targetHandle ? `${edge.target}.${edge.targetHandle}` : edge.target,
  }));

  return {
    id: meta.id,
    version: meta.version,
    name: meta.name,
    description: meta.description,
    inputs: pipelineInputs,
    outputs: pipelineOutputs,
    nodes: pipelineNodes,
    edges: pipelineEdges,
  };
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

export function yamlToPipeline(yaml: string): PipelineDefinition {
  const lines = yaml.split('\n');
  let id = '';
  let version = 1;
  let name = '';
  let description: string | undefined;
  const inputs: PipelineInput[] = [];
  const nodes: PipelineNode[] = [];
  const edges: PipelineEdge[] = [];
  const outputs: PipelineOutput[] = [];

  let section = '';
  let currentInputName = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('id:')) {
      id = trimmed.substring(3).trim();
      continue;
    }
    if (trimmed.startsWith('version:')) {
      version = parseInt(trimmed.substring(8).trim(), 10) || 1;
      continue;
    }
    if (trimmed.startsWith('name:') && section === '') {
      name = trimmed.substring(5).trim();
      continue;
    }
    if (trimmed.startsWith('description:') && section === '') {
      description = trimmed.substring(12).trim();
      continue;
    }

    if (trimmed === 'inputs:' && section === '') {
      section = 'inputs';
      continue;
    }
    if (trimmed === 'nodes:') {
      section = 'nodes';
      continue;
    }
    if (trimmed === 'edges:') {
      section = 'edges';
      continue;
    }
    if (trimmed === 'outputs:') {
      section = 'outputs';
      continue;
    }

    if (section === 'inputs') {
      if (
        !trimmed.startsWith('-') &&
        trimmed.endsWith(':') &&
        !trimmed.startsWith('type:') &&
        !trimmed.startsWith('description:') &&
        !trimmed.startsWith('required:')
      ) {
        currentInputName = trimmed.slice(0, -1).trim();
      } else if (trimmed.startsWith('type:')) {
        const semanticType = trimmed.substring(5).trim();
        inputs.push({
          name: currentInputName,
          semanticType: semanticType as PipelineInput['semanticType'],
          required: true,
        });
      } else if (trimmed.startsWith('required:')) {
        const lastInput = inputs[inputs.length - 1];
        if (lastInput) {
          (lastInput as { required: boolean }).required = trimmed.substring(9).trim() === 'true';
        }
      }
    }

    if (section === 'nodes' && trimmed.startsWith('- id:')) {
      const nodeId = trimmed.substring(5).trim();
      nodes.push({
        id: nodeId,
        capability: {
          id: '' as PipelineNode['capability']['id'],
          version: 1 as PipelineNode['capability']['version'],
        },
      });
    }
    if (section === 'nodes' && trimmed.startsWith('capability:')) {
      const lastNode = nodes[nodes.length - 1];
      if (lastNode) {
        (lastNode as { capability: { id: string } }).capability.id = trimmed.substring(11).trim();
      }
    }

    if (section === 'edges' && trimmed.startsWith('- from:')) {
      edges.push({ from: trimmed.substring(7).trim(), to: '' });
    }
    if (section === 'edges' && trimmed.startsWith('to:')) {
      const lastEdge = edges[edges.length - 1];
      if (lastEdge) {
        (lastEdge as { to: string }).to = trimmed.substring(3).trim();
      }
    }

    if (section === 'outputs' && trimmed.includes(':') && !trimmed.startsWith('-')) {
      const colonIdx = trimmed.indexOf(':');
      outputs.push({
        name: trimmed.substring(0, colonIdx).trim(),
        source: trimmed.substring(colonIdx + 1).trim(),
      });
    }
  }

  return { id, version, name, description, inputs, nodes, edges, outputs };
}

export function pipelineToYaml(definition: PipelineDefinition): string {
  const lines: string[] = [];
  lines.push(`id: ${definition.id}`);
  lines.push(`version: ${definition.version}`);
  lines.push(`name: ${definition.name}`);
  if (definition.description) {
    lines.push(`description: ${definition.description}`);
  }

  lines.push('');
  lines.push('inputs:');
  for (const input of definition.inputs) {
    lines.push(`  ${input.name}:`);
    lines.push(`    type: ${input.semanticType as string}`);
    if (input.description) lines.push(`    description: ${input.description}`);
    lines.push(`    required: ${input.required}`);
  }

  lines.push('');
  lines.push('nodes:');
  for (const node of definition.nodes) {
    lines.push(`  - id: ${node.id}`);
    lines.push(`    capability: ${node.capability.id as string}`);
  }

  lines.push('');
  lines.push('edges:');
  for (const edge of definition.edges) {
    lines.push(`  - from: ${edge.from}`);
    lines.push(`    to: ${edge.to}`);
  }

  lines.push('');
  lines.push('outputs:');
  for (const output of definition.outputs) {
    lines.push(`  ${output.name}: ${output.source}`);
  }

  return lines.join('\n') + '\n';
}
