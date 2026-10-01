import type {
  ExecutionPlan,
  ExecutionStep,
  CachePort,
  ProvenanceRecord,
  CapabilityDefinition,
  Clock,
  RunContext,
  SourcePorts,
  DataSource,
} from '@eve-fabric/domain';
import { CapabilityCatalog, systemClock } from '@eve-fabric/domain';
import { planExecution } from '@eve-fabric/planner';
import { aggregateProvenance } from './aggregate-provenance.js';

export interface ExecutionMetrics {
  readonly totalDurationMs: number;
  readonly stepDurations: ReadonlyMap<string, number>;
  readonly cacheHits: number;
  readonly cacheMisses: number;
}

export interface ExecutionResult {
  /** Each step's output port values, keyed by step id then port name. */
  readonly outputs: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  readonly provenance: ReadonlyMap<string, ProvenanceRecord>;
  readonly metrics: ExecutionMetrics;
}

export interface ExecutorConfig {
  readonly catalog: CapabilityCatalog;
  /** The sources capabilities reach through their `uses`. */
  readonly sources?: SourcePorts | undefined;
  /** Caches SDE and DERIVED steps. ESI steps defer to ESI.ts's own cache (constitution XIV). */
  readonly cache?: CachePort | undefined;
  readonly maxConcurrency?: number | undefined;
  readonly clock?: Clock | undefined;
}

/** A step failed. Names the step and capability; the cause is the run's error. */
export class StepExecutionError extends Error {
  readonly stepId: string;
  readonly capabilityId: string;

  constructor(stepId: string, capabilityId: string, cause: unknown) {
    super(
      `Step "${stepId}" (${capabilityId}) failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = 'StepExecutionError';
    this.stepId = stepId;
    this.capabilityId = capabilityId;
  }
}

/** A capability reached for a source the fabric was not given. */
export class SourceUnavailableError extends Error {
  constructor(capabilityId: string, use: string) {
    super(`Capability "${capabilityId}" uses ${use}, but this fabric has no such source`);
    this.name = 'SourceUnavailableError';
  }
}

/** A port value is not a value of the port's semantic type. */
export class PortValueError extends Error {
  readonly port: string;
  readonly direction: 'input' | 'output';
  readonly typeId: string;

  constructor(direction: 'input' | 'output', port: string, typeId: string, reason: string) {
    super(`${direction === 'input' ? 'Input' : 'Output'} "${port}" is not a ${typeId}: ${reason}`);
    this.name = 'PortValueError';
    this.port = port;
    this.direction = direction;
    this.typeId = typeId;
  }
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

/** JSON with sorted keys, so equal inputs give equal cache keys. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const body = entries.map(([k, v]) => JSON.stringify(k) + ':' + stableJson(v)).join(',');
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

interface StepResult {
  readonly data: Readonly<Record<string, unknown>>;
  readonly provenance: ProvenanceRecord;
  readonly durationMs: number;
  readonly cacheHit: boolean;
}

export class Executor {
  private readonly catalog: CapabilityCatalog;
  private readonly sources: SourcePorts;
  private readonly cache: CachePort | undefined;
  private readonly maxConcurrency: number;
  private readonly clock: Clock;

  constructor(config: ExecutorConfig) {
    this.catalog = config.catalog;
    this.sources = config.sources ?? {};
    this.cache = config.cache;
    this.maxConcurrency = config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
    this.clock = config.clock ?? systemClock;
  }

  async execute(
    plan: ExecutionPlan,
    inputs: ReadonlyMap<string, unknown>,
  ): Promise<ExecutionResult> {
    const startTime = this.clock.now();
    const planned = planExecution(plan);

    const stepMap = new Map<string, ExecutionStep>();
    for (const step of plan.steps) {
      stepMap.set(step.id, step);
    }

    const ttlByStep = new Map<string, number>();
    for (const cs of plan.cacheStrategy) {
      // A TTL of zero would store entries that are already stale.
      if (cs.cacheable && cs.ttlSeconds !== 0) ttlByStep.set(cs.stepId, cs.ttlSeconds);
    }

    const stepOutputs = new Map<string, Readonly<Record<string, unknown>>>();
    const stepProvenance = new Map<string, ProvenanceRecord>();
    const stepDurations = new Map<string, number>();
    let cacheHits = 0;
    let cacheMisses = 0;

    const record = (id: string, result: StepResult): void => {
      stepOutputs.set(id, result.data);
      stepProvenance.set(id, result.provenance);
      stepDurations.set(id, result.durationMs);
      cacheHits += result.cacheHit ? 1 : 0;
      cacheMisses += result.cacheHit ? 0 : 1;
    };

    const runStep = (id: string): Promise<StepResult> => {
      const step = stepMap.get(id);
      if (step === undefined) {
        throw new Error(`Step "${id}" not found in execution plan`);
      }
      return this.executeStep(step, inputs, stepOutputs, ttlByStep.get(id), planned.aliases);
    };

    const processed = new Set<string>();
    let i = 0;
    while (i < planned.orderedSteps.length) {
      const stepId = planned.orderedSteps[i]!;
      const parallelGroup = planned.parallelGroups.find(
        (g) => g.stepIds.includes(stepId) && !processed.has(stepId),
      );

      if (parallelGroup !== undefined) {
        const results = await runWithConcurrency(
          parallelGroup.stepIds.map((id) => () => runStep(id)),
          this.maxConcurrency,
        );
        parallelGroup.stepIds.forEach((id, j) => {
          record(id, results[j]!);
          processed.add(id);
        });
        while (i < planned.orderedSteps.length && processed.has(planned.orderedSteps[i]!)) {
          i++;
        }
      } else {
        record(stepId, await runStep(stepId));
        processed.add(stepId);
        i++;
      }
    }

    // A step merged into an identical one shares its result.
    for (const [alias, kept] of planned.aliases) {
      const output = stepOutputs.get(kept);
      const provenance = stepProvenance.get(kept);
      if (output !== undefined) stepOutputs.set(alias, output);
      if (provenance !== undefined) stepProvenance.set(alias, provenance);
    }

    return {
      outputs: stepOutputs,
      provenance: stepProvenance,
      metrics: {
        totalDurationMs: this.clock.now() - startTime,
        stepDurations,
        cacheHits,
        cacheMisses,
      },
    };
  }

  private async executeStep(
    step: ExecutionStep,
    pipelineInputs: ReadonlyMap<string, unknown>,
    stepOutputs: ReadonlyMap<string, Readonly<Record<string, unknown>>>,
    ttlSeconds: number | undefined,
    aliases: ReadonlyMap<string, string>,
  ): Promise<StepResult> {
    const stepStart = this.clock.now();
    const definition: CapabilityDefinition = this.catalog.get(
      step.capability.id,
      step.capability.version,
    );

    const inputs: Record<string, unknown> = {};
    for (const binding of step.inputs) {
      if (binding.source === 'pipeline-input' && binding.pipelineInputName !== undefined) {
        inputs[binding.portName] = pipelineInputs.get(binding.pipelineInputName);
      } else if (binding.source === 'step-output' && binding.stepId !== undefined) {
        // A step merged into an identical one reads the kept step's result.
        const upstream = stepOutputs.get(aliases.get(binding.stepId) ?? binding.stepId);
        // A binding names the upstream port it reads; the step's other outputs stay put.
        inputs[binding.portName] =
          binding.outputPortName !== undefined ? upstream?.[binding.outputPortName] : upstream;
      }
    }

    // ESI steps defer to ESI.ts's ETag cache; the fabric caches the rest. An
    // SDE result is keyed by the build it came from, so a new export never
    // serves an old answer and a hit still names its build.
    const sourceVersion = this.sourceVersionOf(definition);
    const build = sourceVersion === undefined ? '' : '[' + sourceVersion + ']';
    const cacheKey =
      this.cache !== undefined && ttlSeconds !== undefined && definition.source !== 'ESI'
        ? `${definition.id as string}@${definition.version as string}${build}:${stableJson(inputs)}`
        : undefined;

    if (cacheKey !== undefined) {
      const cached = await this.cache!.get(cacheKey);
      if (cached !== undefined) {
        return {
          data: cached.data as Readonly<Record<string, unknown>>,
          provenance: {
            source: 'CACHE',
            sourceVersion,
            capability: step.capability,
            capabilityVersion: definition.version,
            retrievedAt: cached.storedAt,
            cached: true,
            upstream: [],
          },
          durationMs: this.clock.now() - stepStart,
          cacheHit: true,
        };
      }
    }

    const data = await this.run(step, definition, inputs);

    if (cacheKey !== undefined) {
      await this.cache!.set(cacheKey, data, ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS);
    }

    let provenance = this.provenanceFor(definition);
    if (provenance.upstream.length > 0) {
      provenance = { ...provenance, upstream: aggregateProvenance(provenance.upstream) };
    }

    return { data, provenance, durationMs: this.clock.now() - stepStart, cacheHit: false };
  }

  private async run(
    step: ExecutionStep,
    definition: CapabilityDefinition,
    inputs: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    const id = definition.id as string;
    if (typeof definition.run !== 'function') {
      throw new StepExecutionError(
        step.id,
        id,
        new Error(`Capability "${id}" has no run function (FAB-VAL-01)`),
      );
    }
    this.checkPorts(step, definition, 'input', inputs);
    const context = this.contextFor(definition);
    let result: unknown;
    try {
      result = await definition.run(inputs, context);
    } catch (err) {
      throw new StepExecutionError(step.id, id, err);
    }
    if (result === null || typeof result !== 'object' || Array.isArray(result)) {
      throw new StepExecutionError(
        step.id,
        id,
        new Error('run must return an object of output port values'),
      );
    }
    const outputs = result as Readonly<Record<string, unknown>>;
    this.checkPorts(step, definition, 'output', outputs);
    return outputs;
  }

  /**
   * Port values must be values of the port's type (constitution XVI, phase
   * 3). An absent value (null or undefined) is not checked: an optional input
   * left out, or an output with nothing to report, such as the lowest sell
   * price in a market with no sellers. A catalog without types checks nothing.
   */
  private checkPorts(
    step: ExecutionStep,
    definition: CapabilityDefinition,
    direction: 'input' | 'output',
    values: Readonly<Record<string, unknown>>,
  ): void {
    const types = this.catalog.types;
    if (types === undefined) return;
    const ports = direction === 'input' ? definition.inputs : definition.outputs;
    for (const [name, port] of ports) {
      const value = values[name];
      if (value === undefined || value === null) continue;
      if (port.acceptsName === true && typeof value === 'string' && value.trim() !== '') continue;
      if (!types.has(port.semanticType)) continue;
      const check = types.check(port.semanticType, value);
      if (!check.ok) {
        throw new StepExecutionError(
          step.id,
          definition.id,
          new PortValueError(direction, name, port.semanticType, check.message),
        );
      }
    }
  }

  private contextFor(definition: CapabilityDefinition): RunContext {
    const uses = definition.uses ?? [];
    const id = definition.id as string;
    let esi: unknown;
    let sde: unknown;
    for (const use of uses) {
      if (use === 'sde') {
        if (this.sources.sde === undefined) throw new SourceUnavailableError(id, use);
        sde = this.sources.sde.provider;
      } else if (use === 'esi.public') {
        if (this.sources.esi === undefined) throw new SourceUnavailableError(id, use);
        esi ??= this.sources.esi.public;
      } else {
        // An ESI scope needs the calling identity's view (overhaul phase 6).
        throw new SourceUnavailableError(id, `${use} (no identity)`);
      }
    }
    return { clock: this.clock, esi, sde };
  }

  /** The ESI compatibility date or SDE build a capability's result depends on. */
  private sourceVersionOf(definition: CapabilityDefinition): string | undefined {
    if (definition.source === 'ESI' && this.sources.esi !== undefined) {
      return `esi-compat:${this.sources.esi.compatibilityDate}`;
    }
    if (definition.source === 'SDE' && this.sources.sde !== undefined) {
      return `sde:${this.sources.sde.buildVersion()}`;
    }
    return undefined;
  }

  private provenanceFor(definition: CapabilityDefinition): ProvenanceRecord {
    const at = new Date(this.clock.now());
    const source: DataSource =
      definition.source === 'ESI' || definition.source === 'SDE' ? definition.source : 'DERIVED';
    return {
      source,
      sourceVersion: this.sourceVersionOf(definition),
      capability: { id: definition.id, version: definition.version },
      capabilityVersion: definition.version,
      ...(source === 'DERIVED' ? { calculatedAt: at } : { retrievedAt: at }),
      cached: false,
      upstream: [],
    };
  }
}
