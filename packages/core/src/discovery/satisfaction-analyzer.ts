import type { CapabilityId } from '../capability/capability-id.js';
import type { CapabilityDefinition } from '../capability/capability-definition.js';
import type { SemanticTypeId } from '../semantic-type/semantic-type.js';
import type { CapabilityGraph } from './capability-graph.js';
import type { FlowContext, SatisfactionResult } from './discovery-types.js';

export class SatisfactionAnalyzer {
  private readonly graph: CapabilityGraph;

  constructor(graph: CapabilityGraph) {
    this.graph = graph;
  }

  analyze(capability: CapabilityDefinition, flowContext: FlowContext): SatisfactionResult {
    const satisfiedPorts = new Map<string, SemanticTypeId>();
    const unsatisfiedPorts = new Map<string, SemanticTypeId>();

    for (const [portName, port] of capability.inputs) {
      if (!port.required) continue;

      if (flowContext.availableOutputTypes.has(port.semanticType)) {
        satisfiedPorts.set(portName, port.semanticType);
      } else {
        unsatisfiedPorts.set(portName, port.semanticType);
      }
    }

    const totalRequired = satisfiedPorts.size + unsatisfiedPorts.size;
    const satisfactionRatio = totalRequired > 0 ? satisfiedPorts.size / totalRequired : 1;

    return {
      capabilityId: capability.id,
      availableTypes: flowContext.availableOutputTypes,
      satisfiedPorts,
      unsatisfiedPorts,
      satisfactionRatio,
      isFullySatisfied: unsatisfiedPorts.size === 0,
    };
  }

  analyzeAll(flowContext: FlowContext): Map<CapabilityId, SatisfactionResult> {
    const results = new Map<CapabilityId, SatisfactionResult>();

    for (const type of this.graph.getAllTypes()) {
      for (const cap of this.graph.getConsumers(type)) {
        if (!results.has(cap.id)) {
          results.set(cap.id, this.analyze(cap, flowContext));
        }
      }
      for (const cap of this.graph.getProducers(type)) {
        if (!results.has(cap.id)) {
          results.set(cap.id, this.analyze(cap, flowContext));
        }
      }
    }

    return results;
  }
}
