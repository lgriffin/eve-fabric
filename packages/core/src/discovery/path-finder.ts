import type { CapabilityDefinition } from '../capability/capability-definition.js';
import type { CapabilityId } from '../capability/capability-id.js';
import type { SemanticTypeId } from '../semantic-type/semantic-type.js';
import type { CapabilityGraph } from './capability-graph.js';
import type { PathOptions, PathStep, SemanticPath } from './discovery-types.js';

interface BfsState {
  readonly currentType: SemanticTypeId;
  readonly steps: readonly PathStep[];
  readonly visitedCapabilities: ReadonlySet<CapabilityId>;
}

export class PathFinder {
  private readonly graph: CapabilityGraph;

  constructor(graph: CapabilityGraph) {
    this.graph = graph;
  }

  findPaths(
    sourceType: SemanticTypeId,
    targetType: SemanticTypeId,
    options?: PathOptions,
  ): SemanticPath[] {
    const maxDepth = options?.maxDepth ?? 5;
    const maxResults = options?.maxResults ?? 5;

    if ((sourceType as string) === (targetType as string)) {
      return [];
    }

    const results: SemanticPath[] = [];
    const queue: BfsState[] = [
      {
        currentType: sourceType,
        steps: [],
        visitedCapabilities: new Set<CapabilityId>(),
      },
    ];

    while (queue.length > 0 && results.length < maxResults) {
      const state = queue.shift()!;

      if (state.steps.length >= maxDepth) {
        continue;
      }

      const consumers = this.graph.getConsumers(state.currentType);

      for (const cap of consumers) {
        if (state.visitedCapabilities.has(cap.id)) {
          continue;
        }

        const inputPort = this.findInputPort(cap, state.currentType);
        if (!inputPort) continue;

        for (const [outputPortName, outputPort] of cap.outputs) {
          const step: PathStep = {
            capabilityId: cap.id,
            capabilityName: cap.name,
            capabilityVersion: cap.version,
            inputPort: inputPort.name,
            inputType: state.currentType,
            outputPort: outputPortName,
            outputType: outputPort.semanticType,
            estimatedLatencyMs: cap.cost.estimatedLatencyMs,
          };

          const newSteps = [...state.steps, step];

          if ((outputPort.semanticType as string) === (targetType as string)) {
            results.push(this.buildPath(sourceType, targetType, newSteps, cap));
            if (results.length >= maxResults) break;
          } else if (newSteps.length < maxDepth) {
            const newVisited = new Set(state.visitedCapabilities);
            newVisited.add(cap.id);
            queue.push({
              currentType: outputPort.semanticType,
              steps: newSteps,
              visitedCapabilities: newVisited,
            });
          }
        }

        if (results.length >= maxResults) break;
      }
    }

    if (options?.preferShortest !== false) {
      results.sort((a, b) => {
        if (a.length !== b.length) return a.length - b.length;
        return a.totalEstimatedCost - b.totalEstimatedCost;
      });
    }

    return results;
  }

  private findInputPort(
    cap: CapabilityDefinition,
    semanticType: SemanticTypeId,
  ): { name: string } | undefined {
    for (const [portName, port] of cap.inputs) {
      if ((port.semanticType as string) === (semanticType as string)) {
        return { name: portName };
      }
    }
    return undefined;
  }

  private buildPath(
    sourceType: SemanticTypeId,
    targetType: SemanticTypeId,
    steps: PathStep[],
    lastCap: CapabilityDefinition,
  ): SemanticPath {
    const allScopes = new Set<string>();
    let requiresAuth = false;
    let totalCost = 0;

    const seen = new Set<CapabilityId>();
    for (const step of steps) {
      seen.add(step.capabilityId);
      totalCost += step.estimatedLatencyMs;
    }

    for (const capId of seen) {
      const cap = this.graph.getCapability(capId);
      if (cap?.auth.required) {
        requiresAuth = true;
        for (const scope of cap.auth.scopes) {
          allScopes.add(scope);
        }
      }
    }

    if (lastCap.auth.required) {
      requiresAuth = true;
      for (const scope of lastCap.auth.scopes) {
        allScopes.add(scope);
      }
    }

    return {
      sourceType,
      targetType,
      steps,
      length: steps.length,
      totalEstimatedCost: totalCost,
      requiresAuth,
      authScopes: [...allScopes],
    };
  }
}
