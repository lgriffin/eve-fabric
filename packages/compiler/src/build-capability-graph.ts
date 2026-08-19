/**
 * Builds a topologically-sorted list of execution steps from a pipeline.
 *
 * Creates ExecutionSteps from pipeline nodes, determines dependencies
 * from edges, performs topological sort, and groups independent steps
 * into parallel groups.
 */

import type { CapabilityCatalog } from '@eve-fabric/domain';
import type { PipelineDefinition } from './pipeline-types.js';
import type { ExecutionStep, InputBinding, StepGroup } from './execution-types.js';

export interface CapabilityGraph {
  readonly steps: ExecutionStep[];
  readonly parallelGroups: StepGroup[];
}

function extractNodeId(portRef: string): string {
  const dotIndex = portRef.indexOf('.');
  return dotIndex === -1 ? portRef : portRef.substring(0, dotIndex);
}

function extractPortName(portRef: string): string {
  const dotIndex = portRef.indexOf('.');
  return dotIndex === -1 ? portRef : portRef.substring(dotIndex + 1);
}

/**
 * Builds a topologically-sorted capability graph from a pipeline definition.
 *
 * 1. Creates ExecutionSteps from pipeline nodes
 * 2. Determines dependencies between steps based on edges
 * 3. Uses topological sort (Kahn's algorithm) to order steps
 * 4. Groups independent steps into parallel groups
 */
export function buildCapabilityGraph(
  pipeline: PipelineDefinition,
  _catalog: CapabilityCatalog,
): CapabilityGraph {
  // Build dependency map and input bindings for each node
  const dependencies = new Map<string, Set<string>>();
  const bindings = new Map<string, InputBinding[]>();

  for (const node of pipeline.nodes) {
    dependencies.set(node.id, new Set());
    bindings.set(node.id, []);
  }

  for (const edge of pipeline.edges) {
    const fromNode = extractNodeId(edge.from);
    const toNode = extractNodeId(edge.to);
    const toPort = extractPortName(edge.to);

    // Skip edges going to pipeline outputs or from pipeline outputs
    if (toNode === 'output' || toNode === 'input') continue;

    if (fromNode === 'input') {
      // Pipeline input binding
      const fromPort = extractPortName(edge.from);
      bindings.get(toNode)?.push({
        portName: toPort,
        source: 'pipeline-input' as const,
        pipelineInputName: fromPort,
      });
    } else if (fromNode !== 'output') {
      // Step-to-step binding
      const fromPort = extractPortName(edge.from);
      dependencies.get(toNode)?.add(fromNode);
      bindings.get(toNode)?.push({
        portName: toPort,
        source: 'step-output' as const,
        stepId: fromNode,
        outputPortName: fromPort,
      });
    }
  }

  // Topological sort using Kahn's algorithm with level tracking
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of pipeline.nodes) {
    const deps = dependencies.get(node.id);
    inDegree.set(node.id, deps ? deps.size : 0);
    adjacency.set(node.id, []);
  }

  for (const [nodeId, deps] of dependencies) {
    for (const dep of deps) {
      const neighbors = adjacency.get(dep);
      if (neighbors) {
        neighbors.push(nodeId);
      }
    }
  }

  const sorted: string[] = [];
  const parallelGroups: StepGroup[] = [];

  // Collect initial zero in-degree nodes
  let queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    // All nodes in this batch can execute in parallel
    parallelGroups.push({
      steps: [...queue],
      canParallelize: queue.length > 1,
    });

    const nextQueue: string[] = [];
    for (const current of queue) {
      sorted.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          nextQueue.push(neighbor);
        }
      }
    }
    queue = nextQueue;
  }

  // Build ExecutionSteps in topological order
  const nodeMap = new Map(pipeline.nodes.map((n) => [n.id, n]));

  // Determine which nodes are in multi-step parallel groups
  const parallelNodeIds = new Set<string>();
  for (const group of parallelGroups) {
    if (group.canParallelize) {
      for (const stepId of group.steps) {
        parallelNodeIds.add(stepId);
      }
    }
  }

  const steps: ExecutionStep[] = sorted.map((nodeId) => {
    const node = nodeMap.get(nodeId)!;
    const deps = dependencies.get(nodeId) ?? new Set<string>();

    return {
      id: nodeId,
      capability: {
        id: node.capability.id as string,
        version: node.capability.version as number | undefined,
      },
      inputs: bindings.get(nodeId) ?? [],
      dependsOn: [...deps],
      canParallelize: parallelNodeIds.has(nodeId),
    };
  });

  return { steps, parallelGroups };
}
