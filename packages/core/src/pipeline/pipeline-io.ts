import type { SemanticTypeId } from '../semantic-type/semantic-type.js';

export interface PipelineInput {
  readonly name: string;
  readonly semanticType: SemanticTypeId;
  readonly description?: string | undefined;
  readonly required: boolean;
}

export interface PipelineOutput {
  readonly name: string;
  readonly source: string; // PortReference string like "nodeId.portName"
}
