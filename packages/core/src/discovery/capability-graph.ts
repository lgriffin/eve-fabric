import type { CapabilityId } from '../capability/capability-id.js';
import type { CapabilityDefinition } from '../capability/capability-definition.js';
import type { CapabilityCatalog } from '../capability/catalog.js';
import type { SemanticTypeId } from '../semantic-type/semantic-type.js';

export class CapabilityGraph {
  private readonly capabilities: ReadonlyMap<CapabilityId, CapabilityDefinition>;
  private readonly inputIndex: ReadonlyMap<SemanticTypeId, readonly CapabilityDefinition[]>;
  private readonly outputIndex: ReadonlyMap<SemanticTypeId, readonly CapabilityDefinition[]>;
  private readonly semanticTypes: ReadonlySet<SemanticTypeId>;

  private constructor(
    capabilities: Map<CapabilityId, CapabilityDefinition>,
    inputIndex: Map<SemanticTypeId, CapabilityDefinition[]>,
    outputIndex: Map<SemanticTypeId, CapabilityDefinition[]>,
    semanticTypes: Set<SemanticTypeId>,
  ) {
    this.capabilities = capabilities;
    this.inputIndex = inputIndex;
    this.outputIndex = outputIndex;
    this.semanticTypes = semanticTypes;
  }

  static build(catalog: CapabilityCatalog): CapabilityGraph {
    const capabilities = new Map<CapabilityId, CapabilityDefinition>();
    const inputIndex = new Map<SemanticTypeId, CapabilityDefinition[]>();
    const outputIndex = new Map<SemanticTypeId, CapabilityDefinition[]>();
    const semanticTypes = new Set<SemanticTypeId>();

    for (const def of catalog.list()) {
      capabilities.set(def.id, def);

      const seenInputTypes = new Set<SemanticTypeId>();
      for (const port of def.inputs.values()) {
        semanticTypes.add(port.semanticType);
        if (!seenInputTypes.has(port.semanticType)) {
          seenInputTypes.add(port.semanticType);
          const existing = inputIndex.get(port.semanticType);
          if (existing) {
            existing.push(def);
          } else {
            inputIndex.set(port.semanticType, [def]);
          }
        }
      }

      const seenOutputTypes = new Set<SemanticTypeId>();
      for (const port of def.outputs.values()) {
        semanticTypes.add(port.semanticType);
        if (!seenOutputTypes.has(port.semanticType)) {
          seenOutputTypes.add(port.semanticType);
          const existing = outputIndex.get(port.semanticType);
          if (existing) {
            existing.push(def);
          } else {
            outputIndex.set(port.semanticType, [def]);
          }
        }
      }
    }

    return new CapabilityGraph(capabilities, inputIndex, outputIndex, semanticTypes);
  }

  getConsumers(semanticType: SemanticTypeId): readonly CapabilityDefinition[] {
    return this.inputIndex.get(semanticType) ?? [];
  }

  getProducers(semanticType: SemanticTypeId): readonly CapabilityDefinition[] {
    return this.outputIndex.get(semanticType) ?? [];
  }

  getAllTypes(): ReadonlySet<SemanticTypeId> {
    return this.semanticTypes;
  }

  getCapability(id: CapabilityId): CapabilityDefinition | undefined {
    return this.capabilities.get(id);
  }

  get size(): number {
    return this.capabilities.size;
  }
}
