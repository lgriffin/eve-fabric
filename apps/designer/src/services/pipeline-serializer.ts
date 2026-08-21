import type {
  PipelineDefinition,
  PipelineNode,
  PipelineEdge,
  PipelineInput,
  PipelineOutput,
} from '@eve-fabric/domain';
import type { Edge } from '@xyflow/react';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
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
      capabilityVersion: (node.capability.version as string) ?? '1.0.0',
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
    if (!cap) {
      console.warn(
        `[enrichNodesWithCatalog] Capability '${node.data.capabilityId}' not found in local catalog (${catalog.size} entries: ${[...catalog.keys()].join(', ')})`,
      );
      return node;
    }
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

function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  return fallback;
}

export function yamlToPipeline(yaml: string): PipelineDefinition {
  const doc = parseYaml(yaml) as Record<string, unknown>;

  const id = str(doc.id);
  const version = Number(doc.version) || 1;
  const name = str(doc.name);
  const description = typeof doc.description === 'string' ? doc.description.trim() : undefined;

  const rawInputs = Array.isArray(doc.inputs) ? (doc.inputs as Record<string, unknown>[]) : [];
  const inputs: PipelineInput[] = rawInputs.map((inp) => ({
    name: str(inp.name),
    semanticType: str(inp.semanticType) as PipelineInput['semanticType'],
    description: typeof inp.description === 'string' ? inp.description : undefined,
    required: inp.required !== false,
  }));

  const rawNodes = Array.isArray(doc.nodes) ? (doc.nodes as Record<string, unknown>[]) : [];
  const nodes: PipelineNode[] = rawNodes.map((n) => {
    const cap = n.capability as Record<string, unknown> | string | undefined;
    let capId = '';
    let capVersion = '1.0.0';
    if (typeof cap === 'string') {
      capId = cap;
    } else if (cap && typeof cap === 'object') {
      capId = str(cap.id);
      capVersion = str(cap.version, '1.0.0');
    }
    return {
      id: str(n.id),
      capability: {
        id: capId as PipelineNode['capability']['id'],
        version: capVersion as PipelineNode['capability']['version'],
      },
    };
  });

  const rawEdges = Array.isArray(doc.edges) ? (doc.edges as Record<string, unknown>[]) : [];
  const edges: PipelineEdge[] = rawEdges.map((e) => ({
    from: str(e.from),
    to: str(e.to),
  }));

  const rawOutputs = Array.isArray(doc.outputs) ? (doc.outputs as Record<string, unknown>[]) : [];
  const outputs: PipelineOutput[] = rawOutputs.map((o) => ({
    name: str(o.name),
    source: str(o.source),
  }));

  return { id, version, name, description, inputs, nodes, edges, outputs };
}

export function pipelineToYaml(definition: PipelineDefinition): string {
  const doc: Record<string, unknown> = {
    id: definition.id,
    version: definition.version,
    name: definition.name,
  };
  if (definition.description) {
    doc.description = definition.description;
  }
  doc.inputs = definition.inputs.map((inp) => {
    const entry: Record<string, unknown> = {
      name: inp.name,
      semanticType: inp.semanticType,
    };
    if (inp.description) entry.description = inp.description;
    entry.required = inp.required;
    return entry;
  });
  doc.nodes = definition.nodes.map((node) => ({
    id: node.id,
    capability: { id: node.capability.id, version: node.capability.version },
  }));
  doc.edges = definition.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
  }));
  doc.outputs = definition.outputs.map((output) => ({
    name: output.name,
    source: output.source,
  }));
  return stringifyYaml(doc);
}
