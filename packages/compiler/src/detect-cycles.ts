/**
 * Cycle detection for pipeline graphs using Kahn's algorithm (topological sort).
 *
 * Builds a directed graph from pipeline edges and detects cycles by
 * attempting a topological sort. Nodes remaining after the sort
 * are part of one or more cycles.
 */

import type { PipelineDefinition } from '@eve-fabric/core';
import { type CompilerDiagnostic, cycleDetected } from './diagnostics.js';

/**
 * Extracts the node identifier from a port reference.
 *
 * Port references use the format "nodeId.portName" for node ports
 * or "input.name" for pipeline-level inputs. Only node-to-node
 * edges contribute to the dependency graph.
 */
function extractNodeId(portRef: string): string {
  const dotIndex = portRef.indexOf('.');
  if (dotIndex === -1) {
    return portRef;
  }
  return portRef.substring(0, dotIndex);
}

/**
 * Detects cycles in a pipeline's dependency graph.
 *
 * Uses Kahn's algorithm: repeatedly removes nodes with zero in-degree.
 * Any nodes remaining after the process are part of cycles.
 * When a cycle is found, a DFS extracts the actual cycle path.
 */
export function detectCycles(pipeline: PipelineDefinition): CompilerDiagnostic[] {
  // Build adjacency list and in-degree map from edges
  const adjacency = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Initialize all nodes
  for (const node of pipeline.nodes) {
    adjacency.set(node.id, new Set());
    inDegree.set(node.id, 0);
  }

  // Build edges between nodes (skip pipeline input/output references)
  for (const edge of pipeline.edges) {
    const fromNode = extractNodeId(edge.from);
    const toNode = extractNodeId(edge.to);

    // Skip edges from/to pipeline inputs/outputs (they don't form cycles)
    if (fromNode === 'input' || fromNode === 'output') continue;
    if (toNode === 'input' || toNode === 'output') continue;

    // Skip if either node isn't in the pipeline
    if (!adjacency.has(fromNode) || !adjacency.has(toNode)) continue;

    // Self-referencing edge is itself a cycle
    if (fromNode === toNode) {
      return [cycleDetected([fromNode, fromNode])];
    }

    const neighbors = adjacency.get(fromNode)!;
    if (!neighbors.has(toNode)) {
      neighbors.add(toNode);
      inDegree.set(toNode, (inDegree.get(toNode) ?? 0) + 1);
    }
  }

  // Kahn's algorithm: BFS from nodes with zero in-degree
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const neighbors = adjacency.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }
  }

  // If all nodes were sorted, no cycles exist
  if (sorted.length === pipeline.nodes.length) {
    return [];
  }

  // Extract cycle path from remaining nodes using DFS
  const remaining = new Set<string>();
  for (const [nodeId, degree] of inDegree) {
    if (degree > 0) {
      remaining.add(nodeId);
    }
  }

  const cyclePath = findCyclePath(remaining, adjacency);
  return [cycleDetected(cyclePath)];
}

/**
 * Uses DFS to find a cycle path among the remaining (unresolved) nodes.
 */
function findCyclePath(remaining: Set<string>, adjacency: Map<string, Set<string>>): string[] {
  const visited = new Set<string>();
  const stack: string[] = [];

  for (const startNode of remaining) {
    if (visited.has(startNode)) continue;

    const result = dfsVisit(startNode, remaining, adjacency, visited, stack);
    if (result.length > 0) {
      return result;
    }
  }

  // Fallback: return remaining nodes as the cycle indicator
  return [...remaining, [...remaining][0]!];
}

function dfsVisit(
  node: string,
  remaining: Set<string>,
  adjacency: Map<string, Set<string>>,
  visited: Set<string>,
  stack: string[],
): string[] {
  visited.add(node);
  stack.push(node);

  const neighbors = adjacency.get(node);
  if (neighbors) {
    for (const neighbor of neighbors) {
      if (!remaining.has(neighbor)) continue;

      const stackIndex = stack.indexOf(neighbor);
      if (stackIndex !== -1) {
        // Found cycle: extract path from the cycle start to current, then back to start
        const cyclePath = stack.slice(stackIndex);
        cyclePath.push(neighbor);
        return cyclePath;
      }

      if (!visited.has(neighbor)) {
        const result = dfsVisit(neighbor, remaining, adjacency, visited, stack);
        if (result.length > 0) {
          return result;
        }
      }
    }
  }

  stack.pop();
  return [];
}
