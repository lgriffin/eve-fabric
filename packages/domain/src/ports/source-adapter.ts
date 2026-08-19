import type { CapabilityDefinition } from '../capability/capability-definition.js';
import type { ProvenanceRecord } from '../provenance/provenance-record.js';

export interface SourceAdapterResult {
  readonly data: unknown;
  readonly provenance: ProvenanceRecord;
}

export interface SourceAdapter {
  readonly name: string;
  execute(
    capability: CapabilityDefinition,
    inputs: ReadonlyMap<string, unknown>,
  ): Promise<SourceAdapterResult>;
  supports(capability: CapabilityDefinition): boolean;
}
