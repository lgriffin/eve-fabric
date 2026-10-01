import type {
  CachePort,
  CapabilityDefinition,
  Clock,
  ExecutionPlan,
  PipelineDefinition,
  SemanticTypeDefinition,
  SourcePorts,
  StaticSource,
} from '@eve-fabric/domain';
import {
  CapabilityCatalog,
  InMemoryFabricRegistry,
  SemanticTypeRegistry,
  capabilityId,
  capabilityVersion,
  systemClock,
} from '@eve-fabric/domain';
import {
  compile,
  resolveComposites,
  type CompileOptions,
  type CompileResult,
  type CompilerDiagnostic,
} from '@eve-fabric/compiler';
import { Executor, type ExecutionResult } from '@eve-fabric/executor';
import { MemoryCache } from '@eve-fabric/cache';
import { publishAsComposite, type Pack } from '@eve-fabric/kit';
import { createEsiSource } from '@eve-fabric/source-esi';
import { createStaticSource } from '@eve-fabric/source-sde';
import { Draft, type DraftHost } from './draft.js';
import type { Esi } from '@lgriffin/esi.ts/client';
import type { IStaticDataProvider } from '@lgriffin/esi.ts/sde';

export interface FabricOptions {
  /** ESI.ts's shared runtime, from `createEsi`. Leave out for an SDE- and derived-only fabric. */
  readonly esi?: Esi | undefined;
  /** The compatibility date `esi` was created with; recorded in provenance. */
  readonly esiCompatibilityDate?: string | undefined;
  /** The static data export, as ESI.ts's provider or an already wrapped source. */
  readonly sde?: IStaticDataProvider | StaticSource | undefined;
  /** Capability packs to install. Each capability must carry its run (FAB-VAL-01). */
  readonly packs?: readonly Pack[] | undefined;
  readonly clock?: Clock | undefined;
  /** Caches SDE and DERIVED steps; `false` disables it. Defaults to an in-memory cache. */
  readonly cache?: CachePort | false | undefined;
  readonly maxConcurrency?: number | undefined;
}

export interface PublishCompositeOptions {
  readonly id: string;
  readonly version: string | number;
  readonly name: string;
  readonly description: string;
}

function errorMessages(diagnostics: readonly CompilerDiagnostic[]): string {
  return diagnostics
    .filter((d) => d.severity === 'error')
    .map((d) => d.message)
    .join('; ');
}

/** Thrown when a pipeline is run and does not compile. Carries the compiler's diagnostics. */
export class PipelineCompileError extends Error {
  readonly pipelineId: string;
  readonly diagnostics: readonly CompilerDiagnostic[];

  constructor(pipelineId: string, diagnostics: readonly CompilerDiagnostic[], message?: string) {
    super(message ?? `Pipeline "${pipelineId}" does not compile: ${errorMessages(diagnostics)}`);
    this.name = 'PipelineCompileError';
    this.pipelineId = pipelineId;
    this.diagnostics = diagnostics;
  }
}

/** Thrown when a pipeline is offered for publishing and does not compile (the publish gate). */
export class PublishRefusedError extends PipelineCompileError {
  constructor(pipelineId: string, diagnostics: readonly CompilerDiagnostic[]) {
    super(
      pipelineId,
      diagnostics,
      `Pipeline "${pipelineId}" does not compile and cannot be published: ${errorMessages(diagnostics)}`,
    );
    this.name = 'PublishRefusedError';
  }
}

/** A pack defines a type in a namespace it does not own, or one already defined. */
export class TypeConflictError extends Error {
  readonly typeId: string;

  constructor(packId: string, typeId: string, reason: string) {
    super(`Pack "${packId}" cannot define "${typeId}": ${reason}`);
    this.name = 'TypeConflictError';
    this.typeId = typeId;
  }
}

/** The pack that owns the eve.* namespace. */
const CORE_PACK_ID = '@eve-fabric/pack-core';

const MAX_COMPOSITE_DEPTH = 10;

function isStaticSource(value: IStaticDataProvider | StaticSource): value is StaticSource {
  return 'provider' in value && typeof value.buildVersion === 'function';
}

function asStaticSource(value: IStaticDataProvider | StaticSource): StaticSource {
  return isStaticSource(value) ? value : createStaticSource(value);
}

/**
 * The composition root as a library: sources and packs in, a fabric out.
 * The gateway, the designer's back end and any CLI are transports over this.
 */
export class Fabric implements DraftHost {
  /** The semantic types every port here is checked against. */
  readonly types: SemanticTypeRegistry;
  readonly catalog: CapabilityCatalog;
  readonly registry: InMemoryFabricRegistry;
  readonly executor: Executor;
  readonly sources: SourcePorts;
  readonly clock: Clock;
  private readonly pipelines = new Map<string, PipelineDefinition>();

  constructor(options: FabricOptions = {}) {
    this.clock = options.clock ?? systemClock;
    // The catalog gate: everything registered here can execute (constitution XXVIII).
    // With types: every port type known, every emitted reference followable.
    this.types = new SemanticTypeRegistry();
    this.catalog = new CapabilityCatalog({
      executable: true,
      types: this.types,
      requireResolvers: true,
    });
    this.registry = new InMemoryFabricRegistry(this.catalog);
    this.sources = {
      esi:
        options.esi === undefined
          ? undefined
          : createEsiSource(options.esi, { compatibilityDate: options.esiCompatibilityDate }),
      sde: options.sde === undefined ? undefined : asStaticSource(options.sde),
    };
    const cache =
      options.cache === false
        ? undefined
        : (options.cache ?? new MemoryCache({ clock: this.clock }));
    this.executor = new Executor({
      catalog: this.catalog,
      sources: this.sources,
      cache,
      clock: this.clock,
      maxConcurrency: options.maxConcurrency,
    });
    for (const pack of options.packs ?? []) this.install(pack);
  }

  /**
   * Registers a pack's types, then its capabilities. Throws when a type
   * conflicts, when a reference a capability emits has no resolver here, or
   * on the first capability the catalog refuses.
   */
  install(pack: Pack): void {
    const fresh = (pack.types ?? []).filter((type) => this.checkType(pack, type));
    for (const type of fresh) this.types.register(type);
    try {
      // All the pack's capabilities, or none of them.
      this.registry.registerAll(pack.capabilities);
    } catch (error) {
      for (const type of fresh) this.types.unregister(type.id);
      throw error;
    }
  }

  /** Whether the type is new here; throws when it conflicts. */
  private checkType(pack: Pack, type: SemanticTypeDefinition): boolean {
    const id = type.id as string;
    if (id.startsWith('eve.') && pack.id !== CORE_PACK_ID) {
      throw new TypeConflictError(
        pack.id,
        id,
        `the eve.* namespace is reserved for ${CORE_PACK_ID}`,
      );
    }
    if (!this.types.has(id)) return true;
    if (this.types.get(id) === type) return false;
    throw new TypeConflictError(pack.id, id, 'another definition is already installed');
  }

  /** The catalog: every capability that can run here, and the types they speak. */
  describe(): {
    readonly capabilities: readonly CapabilityDefinition[];
    readonly types: readonly SemanticTypeDefinition[];
  } {
    return { capabilities: this.catalog.list(), types: this.types.list() };
  }

  /** A composite's pipeline, by its `pipelineRef`. */
  getPipeline(id: string, version: number | string): PipelineDefinition | undefined {
    return this.pipelines.get(`${id}@${String(version)}`);
  }

  /**
   * Publishes a pipeline as a composite capability. Only a pipeline that
   * compiles is published (the publish gate); the composite then expands
   * into it wherever it is used.
   */
  publishComposite(
    pipeline: PipelineDefinition,
    options: PublishCompositeOptions,
  ): CapabilityDefinition {
    const compiled = this.compile(pipeline);
    if (!compiled.success) throw new PublishRefusedError(pipeline.id, compiled.diagnostics);
    // Each composite keeps its own copy of the pipeline it was published
    // from, so publishing another view of the same pipeline (other inputs or
    // outputs selected) never changes how an earlier composite expands.
    const own: PipelineDefinition = {
      ...pipeline,
      id: `${pipeline.id}@${options.id}@${String(options.version)}`,
    };
    // Registers the composite in the catalog and its edges in the dependency graph.
    const { capability } = publishAsComposite(own, this.catalog, options, this.registry.getGraph());
    this.pipelines.set(`${own.id}@${own.version}`, own);
    return capability;
  }

  /**
   * The pipeline with every composite expanded to the capabilities that run.
   * Its outputs read the inner ports, so a result keyed by step reads them.
   */
  expand(pipeline: PipelineDefinition): {
    readonly pipeline: PipelineDefinition;
    readonly diagnostics: readonly CompilerDiagnostic[];
  } {
    return this.expandComposites(pipeline);
  }

  /** Expands composites to the capabilities that run, then compiles. */
  compile(pipeline: PipelineDefinition, options?: CompileOptions): CompileResult {
    const expanded = this.expandComposites(pipeline);
    if (expanded.diagnostics.some((d) => d.severity === 'error')) {
      return { success: false, diagnostics: expanded.diagnostics };
    }
    const result = compile(expanded.pipeline, this.catalog, { clock: this.clock, ...options });
    return { ...result, diagnostics: [...expanded.diagnostics, ...result.diagnostics] };
  }

  execute(plan: ExecutionPlan, inputs: ReadonlyMap<string, unknown>): Promise<ExecutionResult> {
    return this.executor.execute(plan, inputs);
  }

  /** Compiles and executes in one call. Throws {@link PipelineCompileError} when it does not compile. */
  async run(
    pipeline: PipelineDefinition,
    inputs: Readonly<Record<string, unknown>>,
  ): Promise<ExecutionResult> {
    const compiled = this.compile(pipeline);
    if (!compiled.success || compiled.plan === undefined) {
      throw new PipelineCompileError(pipeline.id, compiled.diagnostics);
    }
    return this.execute(compiled.plan as unknown as ExecutionPlan, new Map(Object.entries(inputs)));
  }

  /**
   * A draft question from a subject picked by name or id, such as
   * `{ type: 'Tritanium' }`. The draft changes only through the moves it
   * offers and the holes it names (constitution XXVIII).
   */
  draft(subject: Readonly<Record<string, string | number>>): Draft {
    return Draft.start(this, subject);
  }

  /** Runs a complete draft and gives the value at its cursor. Throws while it has holes. */
  async query(
    draft: Draft,
  ): Promise<{ readonly answer: unknown; readonly result: ExecutionResult }> {
    const { plan } = draft.plan();
    const result = await this.execute(plan, new Map(Object.entries(draft.values)));
    return { answer: readAt(result, draft.cursor.ref), result };
  }

  /** Runs one capability on its own, its inputs given by port. */
  async runOne(
    capability: CapabilityDefinition,
    inputs: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    const node = 'one';
    const names = [...capability.inputs.keys()].filter((port) => port in inputs);
    const pipeline: PipelineDefinition = {
      id: `run-one@${capability.id as string}`,
      version: 1,
      name: capability.name,
      inputs: names.map((port) => ({
        name: port,
        semanticType: capability.inputs.get(port)!.semanticType,
        required: true,
      })),
      nodes: [{ id: node, capability: { id: capability.id, version: capability.version } }],
      edges: names.map((port) => ({ from: `input.${port}`, to: `${node}.${port}` })),
      outputs: [...capability.outputs.keys()].map((port) => ({
        name: port,
        source: `${node}.${port}`,
      })),
    };
    const result = await this.run(pipeline, inputs);
    return result.outputs.get(node) ?? {};
  }

  private expandComposites(pipeline: PipelineDefinition): {
    pipeline: PipelineDefinition;
    diagnostics: CompilerDiagnostic[];
  } {
    const diagnostics: CompilerDiagnostic[] = [];
    let current = pipeline;
    for (let depth = 0; depth < MAX_COMPOSITE_DEPTH; depth++) {
      if (!current.nodes.some((node) => this.isComposite(node.capability))) {
        return { pipeline: current, diagnostics };
      }
      const resolved = resolveComposites(current, this.catalog, {
        get: (id, version) => this.getPipeline(id, version),
      });
      diagnostics.push(...resolved.diagnostics);
      current = resolved.expandedPipeline;
    }
    // The last pass may have expanded the last composite.
    if (!current.nodes.some((node) => this.isComposite(node.capability))) {
      return { pipeline: current, diagnostics };
    }
    diagnostics.push({
      code: 'COMPOSITE_DEPTH_EXCEEDED',
      severity: 'error',
      message: `Composites nest deeper than ${MAX_COMPOSITE_DEPTH} levels in "${pipeline.id}"`,
    });
    return { pipeline: current, diagnostics };
  }

  private isComposite(ref: {
    readonly id: string;
    readonly version?: string | undefined;
  }): boolean {
    try {
      const def = this.catalog.get(
        capabilityId(ref.id),
        ref.version !== undefined ? capabilityVersion(ref.version) : undefined,
      );
      return def.source === 'COMPOSITE';
    } catch {
      return false;
    }
  }
}

/** The value at `node.port[.field...]` in a run's outputs. */
function readAt(result: ExecutionResult, ref: string): unknown {
  const [node, port, ...fields] = ref.split('.');
  let value: unknown = result.outputs.get(node!)?.[port!];
  for (const field of fields) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[field];
  }
  return value;
}

export function createFabric(options?: FabricOptions): Fabric {
  return new Fabric(options);
}
