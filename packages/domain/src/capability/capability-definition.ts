import type { CapabilityId, CapabilityVersion, CapabilityRef } from './capability-id.js';
import type { AuthRequirement, CachePolicy, CostModel, CapabilitySource } from './value-objects.js';
import type { SemanticPort } from './semantic-port.js';

export interface PipelineRef {
  readonly id: string;
  readonly version: number;
}

export interface CapabilityDefinition {
  readonly id: CapabilityId;
  readonly version: CapabilityVersion;
  readonly name: string;
  readonly description: string;
  readonly inputs: ReadonlyMap<string, SemanticPort>;
  readonly outputs: ReadonlyMap<string, SemanticPort>;
  readonly source: CapabilitySource;
  readonly dependencies: readonly CapabilityRef[];
  readonly auth: AuthRequirement;
  readonly cache: CachePolicy;
  readonly cost: CostModel;
  readonly pipelineRef?: PipelineRef | undefined;
}
