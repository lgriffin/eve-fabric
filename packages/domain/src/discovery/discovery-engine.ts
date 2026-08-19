import type { CapabilityId } from '../capability/capability-id.js';
import type { CapabilityDefinition } from '../capability/capability-definition.js';
import type { CapabilityCatalog } from '../capability/catalog.js';
import type { SemanticTypeId } from '../semantic-type/semantic-type.js';
import { CapabilityGraph } from './capability-graph.js';
import { PathFinder } from './path-finder.js';
import { SatisfactionAnalyzer } from './satisfaction-analyzer.js';
import type {
  DiscoverySuggestion,
  ExplanationStep,
  FlowContext,
  FlowProposal,
  PathOptions,
  SemanticPath,
  SuggestionOptions,
  ConnectionSuggestion,
  SatisfactionResult,
} from './discovery-types.js';

export class DiscoveryEngine {
  private graph: CapabilityGraph;
  private pathFinder: PathFinder;
  private readonly catalog: CapabilityCatalog;

  constructor(catalog: CapabilityCatalog) {
    this.catalog = catalog;
    this.graph = CapabilityGraph.build(catalog);
    this.pathFinder = new PathFinder(this.graph);
  }

  rebuild(): void {
    this.graph = CapabilityGraph.build(this.catalog);
    this.pathFinder = new PathFinder(this.graph);
  }

  findConsumers(semanticType: SemanticTypeId): DiscoverySuggestion[] {
    const consumers = this.graph.getConsumers(semanticType);
    return consumers.map((cap) => {
      const inputPortName = this.findPortName(cap, 'input', semanticType);
      return this.buildSuggestion(cap, 'port_compatible', 'ready', [
        this.buildExplanation(semanticType, semanticType, cap, inputPortName, inputPortName),
      ]);
    });
  }

  findProducers(semanticType: SemanticTypeId): DiscoverySuggestion[] {
    const producers = this.graph.getProducers(semanticType);
    return producers.map((cap) => {
      const outputPortName = this.findPortName(cap, 'output', semanticType);
      return this.buildSuggestion(cap, 'port_compatible', 'ready', [
        this.buildExplanation(semanticType, semanticType, cap, outputPortName, outputPortName),
      ]);
    });
  }

  findPaths(
    sourceType: SemanticTypeId,
    targetType: SemanticTypeId,
    options?: PathOptions,
  ): SemanticPath[] {
    return this.pathFinder.findPaths(sourceType, targetType, options);
  }

  buildBridgingProposal(path: SemanticPath): FlowProposal {
    const capabilitiesToInsert = path.steps.map((step) => ({
      id: step.capabilityId,
      version: step.capabilityVersion,
      name: step.capabilityName,
    }));

    const connectionsToMake: FlowProposal['connectionsToMake'][number][] = [];
    for (let i = 0; i < path.steps.length - 1; i++) {
      const current = path.steps[i]!;
      const next = path.steps[i + 1]!;
      connectionsToMake.push({
        sourceCapabilityId: current.capabilityId,
        sourcePort: current.outputPort,
        targetCapabilityId: next.capabilityId,
        targetPort: next.inputPort,
      });
    }

    const explanation: ExplanationStep[] = path.steps.map((step) =>
      this.buildExplanation(
        step.inputType,
        step.outputType,
        this.graph.getCapability(step.capabilityId)!,
        step.inputPort,
        step.outputPort,
      ),
    );

    return {
      proposalType: 'bridging',
      capabilitiesToInsert,
      connectionsToMake,
      path,
      explanation,
      estimatedCost: path.totalEstimatedCost,
      authRequirements: [...path.authScopes],
    };
  }

  search(query: string, flowContext?: FlowContext): DiscoverySuggestion[] {
    const lower = query.toLowerCase();
    const results: DiscoverySuggestion[] = [];

    for (const cap of this.catalog.list()) {
      const matchesName = cap.name.toLowerCase().includes(lower);
      const matchesDesc = cap.description.toLowerCase().includes(lower);
      const matchesId = (cap.id as string).toLowerCase().includes(lower);
      const matchesType = this.matchesSemanticType(cap, lower);

      if (matchesName || matchesDesc || matchesId || matchesType) {
        let satisfaction: SatisfactionResult | undefined;
        if (flowContext) {
          const analyzer = new SatisfactionAnalyzer(this.graph);
          satisfaction = analyzer.analyze(cap, flowContext);
        }

        const readiness = this.computeReadiness(satisfaction);

        results.push(
          this.buildSuggestion(
            cap,
            'search_match',
            readiness,
            [],
            satisfaction ? [...satisfaction.satisfiedPorts.keys()] : [],
            satisfaction
              ? [...satisfaction.unsatisfiedPorts.keys()]
              : [...cap.inputs.entries()].filter(([, p]) => p.required).map(([k]) => k),
          ),
        );
      }
    }

    return results;
  }

  suggestNext(flowContext: FlowContext, options?: SuggestionOptions): DiscoverySuggestion[] {
    const maxResults = options?.maxResults ?? 20;
    const includeUnreachable = options?.includeUnreachable ?? false;
    const analyzer = new SatisfactionAnalyzer(this.graph);
    const allResults = analyzer.analyzeAll(flowContext);

    const suggestions: DiscoverySuggestion[] = [];

    for (const [, satisfaction] of allResults) {
      if (flowContext.existingCapabilityIds.has(satisfaction.capabilityId)) {
        continue;
      }

      if (!includeUnreachable && satisfaction.satisfactionRatio === 0) {
        continue;
      }

      const cap = this.graph.getCapability(satisfaction.capabilityId);
      if (!cap) continue;

      const readiness = this.computeReadiness(satisfaction);

      const explanation = this.buildSatisfactionExplanation(cap, satisfaction, flowContext);

      suggestions.push(
        this.buildSuggestion(
          cap,
          'context_aware',
          readiness,
          explanation,
          [...satisfaction.satisfiedPorts.keys()],
          [...satisfaction.unsatisfiedPorts.keys()],
          satisfaction.satisfactionRatio,
        ),
      );
    }

    suggestions.sort((a, b) => b.relevance - a.relevance);
    return suggestions.slice(0, maxResults);
  }

  autoComplete(flowContext: FlowContext, targetCapabilityId: CapabilityId): FlowProposal | null {
    const targetCap = this.graph.getCapability(targetCapabilityId);
    if (!targetCap) return null;

    const missingTypes: SemanticTypeId[] = [];
    for (const [, port] of targetCap.inputs) {
      if (port.required && !flowContext.availableOutputTypes.has(port.semanticType)) {
        missingTypes.push(port.semanticType);
      }
    }

    if (missingTypes.length === 0) return null;

    const allSteps: SemanticPath[] = [];
    for (const missingType of missingTypes) {
      for (const availableType of flowContext.availableOutputTypes) {
        const paths = this.pathFinder.findPaths(availableType, missingType, {
          maxDepth: 5,
          maxResults: 1,
        });
        if (paths.length > 0) {
          allSteps.push(paths[0]!);
          break;
        }
      }
    }

    if (allSteps.length === 0) return null;

    const capabilitiesToInsert = allSteps.flatMap((path) =>
      path.steps.map((step) => ({
        id: step.capabilityId,
        version: step.capabilityVersion,
        name: step.capabilityName,
      })),
    );

    const explanation = allSteps.flatMap((path) =>
      path.steps.map((step) =>
        this.buildExplanation(
          step.inputType,
          step.outputType,
          this.graph.getCapability(step.capabilityId)!,
          step.inputPort,
          step.outputPort,
        ),
      ),
    );

    return {
      proposalType: 'auto_complete',
      capabilitiesToInsert,
      connectionsToMake: [],
      path: allSteps[0] ?? null,
      explanation,
      estimatedCost: allSteps.reduce((sum, p) => sum + p.totalEstimatedCost, 0),
      authRequirements: [...new Set(allSteps.flatMap((p) => [...p.authScopes]))],
    };
  }

  suggestConnections(
    flowContext: FlowContext,
    newCapabilityId: CapabilityId,
  ): ConnectionSuggestion[] {
    const newCap = this.graph.getCapability(newCapabilityId);
    if (!newCap) return [];

    const suggestions: ConnectionSuggestion[] = [];

    for (const [inputPortName, inputPort] of newCap.inputs) {
      if (flowContext.availableOutputTypes.has(inputPort.semanticType)) {
        for (const [nodeId, outputTypes] of flowContext.nodeOutputs) {
          for (const outputType of outputTypes) {
            if ((outputType as string) === (inputPort.semanticType as string)) {
              suggestions.push({
                sourceNodeId: nodeId,
                sourcePortName: 'output',
                sourceType: outputType,
                targetPortName: inputPortName,
                targetType: inputPort.semanticType,
                confidence: 1.0,
                explanation: {
                  fromType: outputType,
                  toType: inputPort.semanticType,
                  viaCapabilityId: newCapabilityId,
                  viaCapabilityName: newCap.name,
                  inputPortName,
                  outputPortName: 'output',
                  description: `${newCap.name} can consume ${inputPort.semanticType as string} via port "${inputPortName}"`,
                },
              });
            }
          }
        }
      }
    }

    return suggestions;
  }

  private matchesSemanticType(cap: CapabilityDefinition, query: string): boolean {
    for (const port of cap.inputs.values()) {
      if ((port.semanticType as string).toLowerCase().includes(query)) return true;
    }
    for (const port of cap.outputs.values()) {
      if ((port.semanticType as string).toLowerCase().includes(query)) return true;
    }
    return false;
  }

  private findPortName(
    cap: CapabilityDefinition,
    direction: 'input' | 'output',
    semanticType: SemanticTypeId,
  ): string {
    const ports = direction === 'input' ? cap.inputs : cap.outputs;
    for (const [name, port] of ports) {
      if ((port.semanticType as string) === (semanticType as string)) {
        return name;
      }
    }
    return 'unknown';
  }

  private buildExplanation(
    fromType: SemanticTypeId,
    toType: SemanticTypeId,
    cap: CapabilityDefinition,
    inputPortName: string,
    outputPortName: string,
  ): ExplanationStep {
    return {
      fromType,
      toType,
      viaCapabilityId: cap.id,
      viaCapabilityName: cap.name,
      inputPortName,
      outputPortName,
      description: `${cap.name} converts ${fromType as string} to ${toType as string}`,
    };
  }

  private buildSuggestion(
    cap: CapabilityDefinition,
    matchReason: DiscoverySuggestion['matchReason'],
    readiness: DiscoverySuggestion['readiness'],
    explanation: ExplanationStep[],
    satisfiedInputs: string[] = [],
    unsatisfiedInputs: string[] = [],
    relevance = 1.0,
  ): DiscoverySuggestion {
    return {
      capabilityId: cap.id,
      capabilityVersion: cap.version,
      capabilityName: cap.name,
      capabilityDescription: cap.description,
      capabilitySource: cap.source,
      relevance,
      readiness,
      satisfiedInputs,
      unsatisfiedInputs,
      explanation,
      matchReason,
    };
  }

  private buildSatisfactionExplanation(
    cap: CapabilityDefinition,
    satisfaction: SatisfactionResult,
    _flowContext: FlowContext,
  ): ExplanationStep[] {
    const steps: ExplanationStep[] = [];

    for (const [portName, satisfiedType] of satisfaction.satisfiedPorts) {
      steps.push({
        fromType: satisfiedType,
        toType: satisfiedType,
        viaCapabilityId: cap.id,
        viaCapabilityName: cap.name,
        inputPortName: portName,
        outputPortName: portName,
        description: `Input "${portName}" (${satisfiedType as string}) is available in the current flow`,
      });
    }

    for (const [portName, missingType] of satisfaction.unsatisfiedPorts) {
      steps.push({
        fromType: missingType,
        toType: missingType,
        viaCapabilityId: cap.id,
        viaCapabilityName: cap.name,
        inputPortName: portName,
        outputPortName: portName,
        description: `Input "${portName}" requires ${missingType as string} which is not available`,
      });
    }

    return steps;
  }

  private computeReadiness(
    satisfaction: SatisfactionResult | undefined,
  ): 'ready' | 'partial' | 'unreachable' {
    if (!satisfaction) return 'unreachable';
    if (satisfaction.isFullySatisfied) return 'ready';
    if (satisfaction.satisfactionRatio > 0) return 'partial';
    return 'unreachable';
  }
}
