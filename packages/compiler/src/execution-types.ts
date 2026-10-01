/**
 * Local execution plan types for the compiler package.
 *
 * These mirror the shapes expected by the domain's ExecutionPlan
 * but are defined locally so the compiler has no circular dependency
 * on types that may still be in flight in the domain package.
 */

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
  readonly capability: { readonly id: string; readonly version?: string | undefined };
  readonly inputs: readonly InputBinding[];
  readonly dependsOn: readonly string[];
  readonly cacheKey?: string | undefined;
  readonly canParallelize: boolean;
  /** Run once per item of the list on `port`, at most `cap` distinct items. */
  readonly each?: { readonly port: string; readonly cap: number } | undefined;
}

export interface StepGroup {
  readonly steps: readonly string[];
  readonly canParallelize: boolean;
}

export interface CostEstimate {
  readonly totalLatencyMs: number;
  readonly esiCallCount: number;
  readonly parallelLatencyMs: number;
}

export interface SourceRequirement {
  readonly source: string;
  readonly capabilities: readonly { readonly id: string; readonly version?: string | undefined }[];
}

export interface CacheStrategy {
  readonly stepId: string;
  readonly cacheable: boolean;
  readonly ttlSeconds: number;
  readonly identityInKey: boolean;
}

export interface ExecutionPlan {
  readonly id: string;
  readonly pipelineRef: { readonly id: string; readonly version: number };
  readonly steps: readonly ExecutionStep[];
  readonly parallelGroups: readonly StepGroup[];
  readonly sourceRequirements: readonly SourceRequirement[];
  readonly authRequirements: { readonly required: boolean; readonly scopes: readonly string[] };
  readonly cacheStrategy: readonly CacheStrategy[];
  readonly costEstimate: CostEstimate;
  readonly createdAt: Date;
}
