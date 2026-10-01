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
  Caller,
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

/** A per-item step was given more distinct items than its cap allows. */
export class PerItemCapError extends Error {
  readonly port: string;
  readonly items: number;
  readonly cap: number;

  constructor(port: string, items: number, cap: number) {
    super(
      `"${port}" has ${items} distinct items, over the per-item cap of ${cap}; raise the cap for this query to run it`,
    );
    this.name = 'PerItemCapError';
    this.port = port;
    this.items = items;
    this.cap = cap;
  }
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

/** A step needs ESI scopes the caller does not hold, or there is no caller at all. */
export class ScopeMissingError extends Error {
  /** The capability that needs the scopes; absent when a whole draft was refused. */
  readonly capabilityId: string | undefined;
  readonly scopes: readonly string[];

  constructor(scopes: readonly string[], identified: boolean, capabilityId?: string) {
    const what = capabilityId === undefined ? 'This question' : `Capability "${capabilityId}"`;
    const them = scopes.length === 1 ? 'that scope' : 'those scopes';
    const fix = identified
      ? "which the caller's token does not hold"
      : `run it as an identity holding ${them}`;
    super(`${what} needs ${scopes.join(', ')}; ${fix}`);
    this.name = 'ScopeMissingError';
    this.capabilityId = capabilityId;
    this.scopes = scopes;
  }
}

/** Options for one run. */
export interface ExecuteOptions {
  /** Who the run is made as; needed by any step whose capability uses an ESI scope. */
  readonly caller?: Caller | undefined;
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

/** The value at a field path inside a record; undefined where a field is absent. */
function readField(value: unknown, fieldPath: readonly string[]): unknown {
  let current = value;
  for (const field of fieldPath) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[field];
  }
  return current;
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
  /** Port values that passed an output check, so the next step need not parse them again. */
  private readonly checkedValues = new WeakSet<object>();

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
    options: ExecuteOptions = {},
  ): Promise<ExecutionResult> {
    const { caller } = options;
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
      return this.executeStep(
        step,
        inputs,
        stepOutputs,
        ttlByStep.get(id),
        planned.aliases,
        caller,
      );
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
    caller: Caller | undefined,
  ): Promise<StepResult> {
    const stepStart = this.clock.now();
    const definition: CapabilityDefinition = this.catalog.get(
      step.capability.id,
      step.capability.version,
    );

    const inputs: Record<string, unknown> = {};
    for (const binding of step.inputs) {
      if (binding.source === 'pipeline-input' && binding.pipelineInputName !== undefined) {
        const value = pipelineInputs.get(binding.pipelineInputName);
        inputs[binding.portName] = readField(value, binding.fieldPath ?? []);
      } else if (binding.source === 'step-output' && binding.stepId !== undefined) {
        // A step merged into an identical one reads the kept step's result.
        const upstream = stepOutputs.get(aliases.get(binding.stepId) ?? binding.stepId);
        // A binding names the upstream port it reads; the step's other outputs stay put.
        const value =
          binding.outputPortName !== undefined ? upstream?.[binding.outputPortName] : upstream;
        // An edge may read a field of a record: an order's location_id.
        inputs[binding.portName] = readField(value, binding.fieldPath ?? []);
      }
    }

    // ESI steps defer to ESI.ts's ETag cache; the fabric caches the rest. An
    // SDE result is keyed by the build it came from, so a new export never
    // serves an old answer and a hit still names its build.
    const sourceVersion = this.sourceVersionOf(definition);
    const build = sourceVersion === undefined ? '' : '[' + sourceVersion + ']';
    // A step that sees one caller's data is keyed by the caller too, so one
    // character's answer is never served to another.
    const identityInKey = definition.cache.identityInKey === true;
    const who = identityInKey ? `{${caller?.key ?? ''}}` : '';
    const cacheKey =
      this.cache !== undefined &&
      ttlSeconds !== undefined &&
      definition.source !== 'ESI' &&
      (!identityInKey || caller !== undefined)
        ? `${definition.id as string}@${definition.version as string}${build}${who}:${stableJson(inputs)}`
        : undefined;

    // A lower cap than the one a cached result ran under still refuses.
    if (cacheKey !== undefined && step.each !== undefined)
      this.distinctItems(step, step.each, definition, inputs);

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

    const data =
      step.each === undefined
        ? await this.run(step, definition, inputs, caller)
        : await this.runEach(step, step.each, definition, inputs, caller);

    if (cacheKey !== undefined) {
      await this.cache!.set(cacheKey, data, ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS);
    }

    let provenance = this.provenanceFor(definition);
    if (provenance.upstream.length > 0) {
      provenance = { ...provenance, upstream: aggregateProvenance(provenance.upstream) };
    }

    return { data, provenance, durationMs: this.clock.now() - stepStart, cacheHit: false };
  }

  /**
   * The items of the per-item port, keyed, and the distinct ones. Throws when
   * there are more distinct items than the cap, before any call or cache read.
   */
  private distinctItems(
    step: ExecutionStep,
    each: { readonly port: string; readonly cap: number },
    definition: CapabilityDefinition,
    inputs: Readonly<Record<string, unknown>>,
  ): { readonly keys: readonly string[]; readonly distinct: ReadonlyMap<string, unknown> } {
    const list = inputs[each.port];
    if (list !== undefined && list !== null && !Array.isArray(list)) {
      throw new StepExecutionError(
        step.id,
        definition.id,
        new Error(`"${each.port}" runs per item, so it takes a list`),
      );
    }
    const items: readonly unknown[] = Array.isArray(list) ? list : [];
    const keys = items.map((item) => stableJson(item));
    const distinct = new Map<string, unknown>();
    items.forEach((item, i) => {
      if (!distinct.has(keys[i]!)) distinct.set(keys[i]!, item);
    });
    if (distinct.size > each.cap) {
      throw new StepExecutionError(
        step.id,
        definition.id,
        new PerItemCapError(each.port, distinct.size, each.cap),
      );
    }
    return { keys, distinct };
  }

  /**
   * Runs the step once per distinct item of the list on the per-item port,
   * and gives each output as a list in the input's order. Fails before any
   * call when there are more distinct items than the cap.
   */
  private async runEach(
    step: ExecutionStep,
    each: { readonly port: string; readonly cap: number },
    definition: CapabilityDefinition,
    inputs: Readonly<Record<string, unknown>>,
    caller: Caller | undefined,
  ): Promise<Readonly<Record<string, unknown>>> {
    const { keys, distinct } = this.distinctItems(step, each, definition, inputs);
    const entries = [...distinct.entries()];
    const results = await runWithConcurrency(
      entries.map(
        ([, item]) =>
          () =>
            this.run(step, definition, { ...inputs, [each.port]: item }, caller),
      ),
      this.maxConcurrency,
    );
    const byKey = new Map(entries.map(([key], i) => [key, results[i]!]));
    const outputs: Record<string, unknown[]> = {};
    for (const name of definition.outputs.keys()) {
      outputs[name] = keys.map((key) => byKey.get(key)![name]);
    }
    return outputs;
  }

  private async run(
    step: ExecutionStep,
    definition: CapabilityDefinition,
    inputs: Readonly<Record<string, unknown>>,
    caller: Caller | undefined,
  ): Promise<Readonly<Record<string, unknown>>> {
    const id = definition.id as string;
    if (typeof definition.run !== 'function') {
      throw new StepExecutionError(
        step.id,
        id,
        new Error(`Capability "${id}" has no run function (FAB-VAL-01)`),
      );
    }
    const checked = this.checkPorts(step, definition, 'input', inputs);
    const context = this.contextFor(definition, caller);
    let result: unknown;
    try {
      result = await definition.run(checked, context);
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
    return this.checkPorts(step, definition, 'output', result as Readonly<Record<string, unknown>>);
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
  ): Readonly<Record<string, unknown>> {
    const types = this.catalog.types;
    if (types === undefined) return values;
    const ports = direction === 'input' ? definition.inputs : definition.outputs;
    const parsed: Record<string, unknown> = { ...values };
    for (const [name, port] of ports) {
      const value = values[name];
      if (value === undefined || value === null) continue;
      // An output this run already checked arrives as the same object: no second parse.
      if (typeof value === 'object' && this.checkedValues.has(value)) continue;
      const check = types.checkPort(port, value);
      if (!check.ok) {
        throw new StepExecutionError(
          step.id,
          definition.id,
          new PortValueError(direction, name, port.semanticType, check.message),
        );
      }
      // Steps get the parsed value: an id sent as text arrives as a number.
      parsed[name] = check.value;
      if (direction === 'output' && typeof check.value === 'object' && check.value !== null) {
        this.checkedValues.add(check.value);
      }
    }
    return parsed;
  }

  private contextFor(definition: CapabilityDefinition, caller: Caller | undefined): RunContext {
    const uses = definition.uses ?? [];
    const id = definition.id as string;
    let esi: unknown;
    let sde: unknown;
    let characterId: number | undefined;
    const scopes = uses.filter((use) => use.startsWith('esi:')).map((use) => use.slice(4));
    if (scopes.length > 0) {
      // A scoped capability gets the caller's view, and only with every scope it declared.
      if (this.sources.esi === undefined) throw new SourceUnavailableError(id, `esi:${scopes[0]!}`);
      const missing = scopes.filter((scope) => !(caller?.scopes ?? []).includes(scope));
      if (caller === undefined || missing.length > 0) {
        throw new ScopeMissingError(
          caller === undefined ? scopes : missing,
          caller !== undefined,
          id,
        );
      }
      esi = this.sources.esi.as(caller.credentials);
      characterId = caller.characterId;
    }
    for (const use of uses) {
      if (use === 'sde') {
        if (this.sources.sde === undefined) throw new SourceUnavailableError(id, use);
        sde = this.sources.sde.provider;
      } else if (use === 'esi.public') {
        if (this.sources.esi === undefined) throw new SourceUnavailableError(id, use);
        esi ??= this.sources.esi.public;
      }
    }
    return { clock: this.clock, esi, sde, ...(characterId === undefined ? {} : { characterId }) };
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
