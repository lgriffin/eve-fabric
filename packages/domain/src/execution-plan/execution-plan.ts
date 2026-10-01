import type { CapabilityRef } from '../capability/capability-id.js';
import type { AuthRequirement, CapabilitySource } from '../capability/value-objects.js';

export interface InputBinding {
  readonly portName: string;
  readonly source: 'pipeline-input' | 'step-output';
  readonly pipelineInputName?: string | undefined;
  readonly stepId?: string | undefined;
  readonly outputPortName?: string | undefined;
  /** Fields read inside the output port's value, outermost first (a record's `location_id`). */
  readonly fieldPath?: readonly string[] | undefined;
}

export interface ExecutionStep {
  readonly id: string;
  readonly capability: CapabilityRef;
  readonly inputs: readonly InputBinding[];
  readonly dependsOn: readonly string[];
  readonly cacheKey?: string | undefined;
  readonly canParallelize: boolean;
}

export interface StepGroup {
  readonly steps: readonly string[];
  readonly canParallelize: boolean;
}

export interface SourceRequirement {
  readonly source: CapabilitySource;
  readonly capabilities: readonly CapabilityRef[];
}

export interface CacheStrategy {
  readonly stepId: string;
  readonly cacheable: boolean;
  readonly ttlSeconds: number;
  readonly identityInKey: boolean;
}

export interface CostEstimate {
  readonly totalLatencyMs: number;
  readonly esiCallCount: number;
  readonly parallelLatencyMs: number;
}

export interface ExecutionPlan {
  readonly id: string;
  readonly pipelineRef: { readonly id: string; readonly version: number };
  readonly steps: readonly ExecutionStep[];
  readonly parallelGroups: readonly StepGroup[];
  readonly sourceRequirements: readonly SourceRequirement[];
  readonly authRequirements: AuthRequirement;
  readonly cacheStrategy: readonly CacheStrategy[];
  readonly costEstimate: CostEstimate;
  readonly createdAt: Date;
}
