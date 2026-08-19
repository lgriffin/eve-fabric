import type { CapabilityDefinition } from '@eve-fabric/domain';
import type { PipelineDefinition } from '@eve-fabric/domain';

export interface DependencyNode {
  readonly nodeId: string;
  readonly dependsOn: readonly string[];
}

export function resolveDependencies(
  pipeline: PipelineDefinition,
  _resolved: ReadonlyMap<string, CapabilityDefinition>,
): DependencyNode[] {
  const edgeMap = new Map<string, Set<string>>();

  for (const node of pipeline.nodes) {
    edgeMap.set(node.id, new Set());
  }

  for (const edge of pipeline.edges) {
    const fromNode = edge.from.substring(0, edge.from.indexOf('.'));
    const toNode = edge.to.substring(0, edge.to.indexOf('.'));

    if (fromNode === 'input' || fromNode === 'output') continue;
    if (toNode === 'input' || toNode === 'output') continue;

    const deps = edgeMap.get(toNode);
    if (deps) {
      deps.add(fromNode);
    }
  }

  return pipeline.nodes.map((node) => ({
    nodeId: node.id,
    dependsOn: [...(edgeMap.get(node.id) ?? [])],
  }));
}
