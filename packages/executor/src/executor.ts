import type {
  ExecutionPlan,
  ExecutionStep,
  SourceAdapter,
  SourceAdapterResult,
  CachePort,
  ProvenanceRecord,
} from '@eve-fabric/domain';
import { planExecution } from '@eve-fabric/planner';

export interface ExecutionMetrics {
  readonly totalDurationMs: number;
  readonly stepDurations: ReadonlyMap<string, number>;
  readonly cacheHits: number;
  readonly cacheMisses: number;
}

export interface ExecutionResult {
  readonly outputs: ReadonlyMap<string, unknown>;
  readonly provenance: ReadonlyMap<string, ProvenanceRecord>;
  readonly metrics: ExecutionMetrics;
}

export interface ExecutorConfig {
  readonly adapters: readonly SourceAdapter[];
  readonly cache?: CachePort | undefined;
  readonly maxConcurrency?: number | undefined;
}

const DEFAULT_MAX_CONCURRENCY = 5;
const DEFAULT_CACHE_TTL_SECONDS = 300;

/**
 * Execute an array of async functions with a concurrency limit.
 */
async function runWithConcurrency<T>(
  tasks: readonly (() => Promise<T>)[],
  limit: number,
): Promise<readonly T[]> {
  const results: T[] = new Array(tasks.length) as T[];
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex++;
      results[index] = await tasks[index]!();
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i++) {
    workers.push(runNext());
  }

  await Promise.all(workers);
  return results;
}

export class Executor {
  private readonly adapters: readonly SourceAdapter[];
  private readonly cache: CachePort | undefined;
  private readonly maxConcurrency: number;

  constructor(config: ExecutorConfig) {
    this.adapters = config.adapters;
    this.cache = config.cache;
    this.maxConcurrency = config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
  }

  async execute(
    plan: ExecutionPlan,
    inputs: ReadonlyMap<string, unknown>,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    const planned = planExecution(plan);

    // Build lookup maps
    const stepMap = new Map<string, ExecutionStep>();
    for (const step of plan.steps) {
      stepMap.set(step.id, step);
    }

    const capabilityToSource = new Map<string, string>();
    for (const req of plan.sourceRequirements) {
      for (const cap of req.capabilities) {
        capabilityToSource.set(cap.id, req.source);
      }
    }

    const cacheStrategyMap = new Map<string, { ttlSeconds: number; cacheable: boolean }>();
    for (const cs of plan.cacheStrategy) {
      cacheStrategyMap.set(cs.stepId, { ttlSeconds: cs.ttlSeconds, cacheable: cs.cacheable });
    }

    // Results and metrics tracking
    const stepOutputs = new Map<string, unknown>();
    const stepProvenance = new Map<string, ProvenanceRecord>();
    const stepDurations = new Map<string, number>();
    let cacheHits = 0;
    let cacheMisses = 0;

    // Process steps in order, batching parallel groups
    const processed = new Set<string>();
    let i = 0;

    while (i < planned.orderedSteps.length) {
      const stepId = planned.orderedSteps[i]!;

      // Check if this step starts a parallel group
      const parallelGroup = planned.parallelGroups.find(
        (g) => g.stepIds.includes(stepId) && !processed.has(stepId),
      );

      if (parallelGroup !== undefined) {
        // Execute all steps in the parallel group concurrently
        const tasks = parallelGroup.stepIds.map((id) => {
          return async () => {
            const step = stepMap.get(id);
            if (step === undefined) {
              throw new Error(`Step "${id}" not found in execution plan`);
            }
            return this.executeStep(
              step,
              inputs,
              stepOutputs,
              capabilityToSource,
              cacheStrategyMap,
            );
          };
        });

        const results = await runWithConcurrency(tasks, this.maxConcurrency);

        for (let j = 0; j < parallelGroup.stepIds.length; j++) {
          const id = parallelGroup.stepIds[j]!;
          const result = results[j]!;
          stepOutputs.set(id, result.data);
          stepProvenance.set(id, result.provenance);
          stepDurations.set(id, result.durationMs);
          cacheHits += result.cacheHit ? 1 : 0;
          cacheMisses += result.cacheHit ? 0 : 1;
          processed.add(id);
        }

        // Skip past all steps in this group that appear in orderedSteps
        while (i < planned.orderedSteps.length && processed.has(planned.orderedSteps[i]!)) {
          i++;
        }
      } else {
        // Execute single step
        const step = stepMap.get(stepId);
        if (step === undefined) {
          throw new Error(`Step "${stepId}" not found in execution plan`);
        }

        const result = await this.executeStep(
          step,
          inputs,
          stepOutputs,
          capabilityToSource,
          cacheStrategyMap,
        );

        stepOutputs.set(stepId, result.data);
        stepProvenance.set(stepId, result.provenance);
        stepDurations.set(stepId, result.durationMs);
        cacheHits += result.cacheHit ? 1 : 0;
        cacheMisses += result.cacheHit ? 0 : 1;
        processed.add(stepId);
        i++;
      }
    }

    const totalDurationMs = Date.now() - startTime;

    return {
      outputs: stepOutputs,
      provenance: stepProvenance,
      metrics: {
        totalDurationMs,
        stepDurations,
        cacheHits,
        cacheMisses,
      },
    };
  }

  private async executeStep(
    step: ExecutionStep,
    pipelineInputs: ReadonlyMap<string, unknown>,
    stepOutputs: ReadonlyMap<string, unknown>,
    capabilityToSource: ReadonlyMap<string, string>,
    cacheStrategyMap: ReadonlyMap<string, { ttlSeconds: number; cacheable: boolean }>,
  ): Promise<{
    data: unknown;
    provenance: ProvenanceRecord;
    durationMs: number;
    cacheHit: boolean;
  }> {
    const stepStart = Date.now();

    // Check cache first
    if (this.cache !== undefined && step.cacheKey !== undefined) {
      const cached = await this.cache.get(step.cacheKey);
      if (cached !== undefined) {
        const durationMs = Date.now() - stepStart;
        return {
          data: cached.data,
          provenance: {
            source: 'CACHE',
            capability: step.capability,
            capabilityVersion: step.capability.version ?? '1.0.0',
            cached: true,
            upstream: [],
          },
          durationMs,
          cacheHit: true,
        };
      }
    }

    // Resolve inputs for this step
    const resolvedInputs = new Map<string, unknown>();
    for (const input of step.inputs) {
      if (input.source === 'pipeline-input' && input.pipelineInputName !== undefined) {
        resolvedInputs.set(input.portName, pipelineInputs.get(input.pipelineInputName));
      } else if (input.source === 'step-output' && input.stepId !== undefined) {
        resolvedInputs.set(input.portName, stepOutputs.get(input.stepId));
      }
    }

    // Find the right adapter
    const source = capabilityToSource.get(step.capability.id);
    const adapter = this.findAdapter(source);

    // Execute via adapter
    const result: SourceAdapterResult = await adapter.execute(
      // The adapter expects CapabilityDefinition but we have CapabilityRef.
      // In a full implementation, the executor would resolve the ref through a catalog.
      // For now, pass the ref as the capability; adapters handle accordingly.
      step.capability as never,
      resolvedInputs,
    );

    // Store in cache
    if (this.cache !== undefined && step.cacheKey !== undefined) {
      const strategy = cacheStrategyMap.get(step.id);
      const ttl = strategy?.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
      await this.cache.set(step.cacheKey, result.data, ttl);
    }

    const durationMs = Date.now() - stepStart;

    return {
      data: result.data,
      provenance: result.provenance,
      durationMs,
      cacheHit: false,
    };
  }

  private findAdapter(source: string | undefined): SourceAdapter {
    if (source !== undefined) {
      for (const adapter of this.adapters) {
        if (adapter.name === source) {
          return adapter;
        }
      }
    }

    // Fall back to checking supports() on each adapter
    // (requires CapabilityDefinition, so may not work with CapabilityRef)
    throw new Error(`No adapter found for source "${source ?? 'unknown'}"`);
  }
}
