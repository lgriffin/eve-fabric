import type {
  Caller,
  CachePort,
  CapabilityDefinition,
  Clock,
  ExecutionPlan,
  PipelineDefinition,
  SemanticTypeDefinition,
  SourcePorts,
  StaticSource,
  Store,
} from '@eve-fabric/core';
import {
  CapabilityCatalog,
  InMemoryFabricRegistry,
  SemanticTypeRegistry,
  capabilityId,
  capabilityVersion,
  systemClock,
} from '@eve-fabric/core';
import {
  compile,
  resolveComposites,
  type CompileOptions,
  type CompileResult,
  type CompilerDiagnostic,
} from '@eve-fabric/compiler';
import { Executor, ScopeMissingError, type ExecutionResult } from '@eve-fabric/executor';
import { MemoryCache } from '@eve-fabric/cache';
import { publishAsComposite, type Pack, type Weave } from '@eve-fabric/kit';
import {
  canonicalJson,
  readWeave,
  sealWeave,
  weaveFromYaml,
  weaveToYaml,
  type WeaveFile,
  WeaveNotFoundError,
  type WeaveIndex,
} from '@eve-fabric/weave';
import { createEsiSource } from '@eve-fabric/source-esi';
import { createStaticSource } from '@eve-fabric/source-sde';
import { CharacterMismatchError, Draft, type DraftHost, type FabricIdentity } from './draft.js';
import { deriveSchema, GraphQLDraftError, parseDraft } from './graphql.js';
import {
  describeWeave,
  localWeave,
  weaveFromDraft,
  WeaveMismatchError,
  WeaveRefusedError,
  type WeaveOptions,
} from './weaving.js';
import { parse, validate, type GraphQLSchema } from 'graphql';
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
  /** Keeps the weaves added at run time; `restore` brings them back. Defaults to none. */
  readonly store?: Store | undefined;
  /** Where `add` looks up a weave named as `id@range`. */
  readonly index?: WeaveIndex | undefined;
}

export interface PublishCompositeOptions {
  readonly id: string;
  readonly version: string | number;
  readonly name: string;
  readonly description: string;
  /** Where the composite hangs in the type graph, so drafts offer it as a move. */
  readonly attach?:
    { readonly on: string; readonly as: string; readonly subject: string } | undefined;
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

/** What {@link Fabric.restore} brought back, and what it could not, with why. */
export interface RestoreResult {
  readonly restored: number;
  readonly skipped: readonly {
    readonly id: string;
    readonly version: string;
    readonly error: Error;
  }[];
}

const keyOf = (weave: { readonly id: string; readonly version: string }): string =>
  `${weave.id}@${weave.version}`;

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
  /** The digest of each weave added, by `id@version`. */
  private readonly added = new Map<string, string>();
  private readonly store: Store | undefined;
  private readonly index: WeaveIndex | undefined;
  private derived: GraphQLSchema | undefined;

  constructor(options: FabricOptions = {}) {
    this.clock = options.clock ?? systemClock;
    this.store = options.store;
    this.index = options.index;
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
    this.derived = undefined;
    const fresh = (pack.types ?? []).filter((type) => this.checkType(pack, type));
    for (const type of fresh) this.types.register(type);
    const added: CapabilityDefinition[] = [];
    try {
      // All the pack's capabilities, or none of them.
      this.registry.registerAll(pack.capabilities);
      added.push(...pack.capabilities);
      // Then its weaves, which compile against what is now installed.
      for (const weave of pack.weaves ?? []) {
        added.push(this.publishComposite(weave.pipeline, weave.capability));
      }
    } catch (error) {
      const undo = [...added];
      undo.reverse();
      for (const capability of undo) this.withdraw(capability);
      for (const type of fresh) this.types.unregister(type.id);
      throw error;
    }
  }

  /** Takes back a capability an install added: its entry, its edges, and a weave's pipeline. */
  private withdraw(capability: CapabilityDefinition): void {
    this.derived = undefined;
    this.catalog.unregister(capability.id, capability.version);
    const graph = this.registry.getGraph();
    const ref = { id: capability.id, version: capability.version };
    for (const dep of capability.dependencies) graph.removeDependency(ref, dep);
    const pipeline = capability.pipelineRef;
    if (pipeline !== undefined) this.pipelines.delete(`${pipeline.id}@${pipeline.version}`);
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
    // A list of an installed type is implied, not registered, so it is new here.
    if (!this.types.hasRegistered(id)) return true;
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
    this.derived = undefined;
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

  /** Executes a plan, as `as` when its steps need ESI scopes. */
  execute(
    plan: ExecutionPlan,
    inputs: ReadonlyMap<string, unknown>,
    as?: FabricIdentity,
  ): Promise<ExecutionResult> {
    return this.executor.execute(plan, inputs, { caller: callerOf(as) });
  }

  /** Compiles and executes in one call. Throws {@link PipelineCompileError} when it does not compile. */
  async run(
    pipeline: PipelineDefinition,
    inputs: Readonly<Record<string, unknown>>,
    as?: FabricIdentity,
  ): Promise<ExecutionResult> {
    const compiled = this.compile(pipeline);
    if (!compiled.success || compiled.plan === undefined) {
      throw new PipelineCompileError(pipeline.id, compiled.diagnostics);
    }
    return this.execute(
      compiled.plan as unknown as ExecutionPlan,
      new Map(Object.entries(inputs)),
      as,
    );
  }

  /**
   * A draft question from a subject picked by name or id, such as
   * `{ type: 'Tritanium' }`. The draft changes only through the moves it
   * offers and the holes it names (constitution XXVIII). Asked `as` an
   * identity, moves needing a scope its token lacks are offered as
   * unavailable, naming the scope (FAB-VAL-07); `query` runs as it.
   */
  draft(
    subject: string | Readonly<Record<string, string | number>>,
    options: { readonly as?: FabricIdentity | undefined } = {},
  ): Draft {
    return Draft.start(this, subject, options.as);
  }

  /**
   * The draft a GraphQL document describes. Each field is a move and its
   * arguments fill the holes the move opens, so a document that parses is a
   * draft the fabric offered, and one that is complete plans (FAB-VAL-06).
   */
  fromGraphQL(document: string, options: { readonly as?: FabricIdentity | undefined } = {}): Draft {
    // Checked against the derived schema first, so a document this takes is
    // one the schema says is valid: every subject named once, every hole given.
    const errors = validate(this.schema(), parse(document));
    if (errors.length > 0) {
      throw new GraphQLDraftError(errors.map((e) => e.message).join('; '));
    }
    return parseDraft(this, document, options.as);
  }

  /**
   * The GraphQL schema derived from what is installed: each type's fields are
   * the moves a draft offers on it, their arguments the holes those moves
   * open (FAB-VAL-05). For introspection and tooling.
   */
  schema(): GraphQLSchema {
    this.derived ??= deriveSchema(this);
    return this.derived;
  }

  /**
   * Runs a complete draft and gives the value at its cursor. Throws while it
   * has holes. `perItemCap` raises the cap on per-item steps for this query.
   */
  async query(
    draft: Draft,
    options: {
      readonly perItemCap?: number | undefined;
      /** Run as this identity instead of the draft's own. */
      readonly as?: FabricIdentity | undefined;
    } = {},
  ): Promise<{ readonly answer: unknown; readonly result: ExecutionResult }> {
    const { plan, scopes } = draft.plan();
    const identity = options.as ?? draft.identity;
    // Refuse before the first call rather than part way through.
    const missing = scopes.filter((scope) => !(identity?.scopes ?? []).includes(scope));
    if (missing.length > 0) {
      throw new ScopeMissingError(missing, identity !== undefined);
    }
    const foreign = scopes.length > 0 ? draft.as(identity).foreignCharacter() : undefined;
    if (foreign !== undefined) throw new CharacterMismatchError(foreign, identity!.characterId);
    const cap = options.perItemCap;
    if (cap !== undefined && !(Number.isInteger(cap) && cap > 0)) {
      throw new RangeError(`perItemCap must be a positive whole number, not ${String(cap)}`);
    }
    const capped: ExecutionPlan =
      cap === undefined
        ? plan
        : {
            ...plan,
            steps: plan.steps.map((step) =>
              step.each === undefined ? step : { ...step, each: { ...step.each, cap } },
            ),
          };
    const result = await this.executor.execute(capped, new Map(Object.entries(draft.values)), {
      caller: callerOf(identity),
    });
    // A composite at the cursor runs as its inner steps; read the one it names.
    const answer = this.expand(draft.pipeline()).pipeline.outputs.find((o) => o.name === 'answer');
    const value = readAt(result, answer?.source ?? draft.cursor.ref);
    return { answer: narrowed(value, draft.selection), result };
  }

  /** A complete draft as a weave, offered `as` a move on what it started from. */
  weave(draft: Draft, options: WeaveOptions): Weave {
    return weaveFromDraft(draft, this.catalog, this.types, options);
  }

  /**
   * A weave as package format v2, with what it requires, the scopes it
   * needs, what it was checked against and its digest. Takes a weave, or the
   * id of one already published here.
   */
  export(what: Weave | string, version?: string): WeaveFile {
    const weave = typeof what === 'string' ? this.publishedWeave(what, version) : what;
    const compiled = this.compile(weave.pipeline);
    if (!compiled.success || compiled.plan === undefined) {
      throw new PublishRefusedError(weave.pipeline.id, compiled.diagnostics);
    }
    return sealWeave(
      describeWeave(weave, this.catalog, compiled.plan.authRequirements.scopes, {
        esiCompatibilityDate: this.sources.esi?.compatibilityDate,
        sdeBuild: this.sources.sde?.buildVersion(),
      }),
    );
  }

  /**
   * Adds a weave: a file, its YAML, or `id@range` looked up in the index.
   * Refused whole, adding nothing, unless its digest matches, every
   * capability it requires is here in a version it accepts, it compiles, and
   * the scopes and ports it declares are the ones it compiles to (FAB-VAL-08).
   */
  async add(
    source: WeaveFile | string,
    options: { readonly index?: WeaveIndex | undefined } = {},
  ): Promise<CapabilityDefinition> {
    const file = await this.weaveFile(source, options.index ?? this.index);
    const key = `${file.id}@${file.version}`;
    if (this.added.get(key) === file.digest) {
      return this.catalog.get(capabilityId(file.id), capabilityVersion(file.version));
    }
    const capability = this.take(file);
    try {
      await this.store?.putWeave({
        id: file.id,
        version: file.version,
        digest: file.digest,
        document: weaveToYaml(file),
      });
    } catch (error) {
      this.withdraw(capability);
      this.added.delete(key);
      throw error;
    }
    return capability;
  }

  /** The weaves added here, by id, version and digest. */
  weaves(): readonly { readonly id: string; readonly version: string; readonly digest: string }[] {
    return [...this.added].map(([key, digest]) => {
      const at = key.lastIndexOf('@');
      return { id: key.slice(0, at), version: key.slice(at + 1), digest };
    });
  }

  /**
   * Takes back a weave added here, and forgets it in the store. Refused while
   * another capability is built on it.
   */
  async remove(id: string, version: string): Promise<void> {
    const key = `${id}@${version}`;
    if (!this.added.has(key)) throw new WeaveNotFoundError(key);
    const capability = this.catalog.get(capabilityId(id), capabilityVersion(version));
    const dependents = this.registry.getDependents({
      id: capability.id,
      version: capability.version,
    });
    if (dependents.length > 0) {
      const names = dependents.map((d) => `${d.id}@${String(d.version)}`).join(', ');
      throw new WeaveRefusedError(`"${key}" cannot be removed: ${names} is built on it`);
    }
    await this.store?.removeWeave(id, version);
    this.withdraw(capability);
    this.added.delete(key);
  }

  /**
   * Adds back every weave the store kept, as many as can be added here. One
   * that cannot (a capability it requires is gone, or it no longer compiles
   * to what it declares) is skipped, with why, rather than stopping the rest.
   */
  async restore(): Promise<RestoreResult> {
    const kept = (await this.store?.listWeaves()) ?? [];
    const failed = new Map<string, Error>();
    let pending = kept.filter((stored) => this.added.get(keyOf(stored)) !== stored.digest);
    // A weave may require another; add what can be added until nothing changes.
    for (;;) {
      const left = pending.filter((stored) => {
        try {
          const key = keyOf(stored);
          if (this.added.has(key)) {
            throw new WeaveRefusedError(`"${key}" is already here with another digest`);
          }
          this.take(weaveFromYaml(stored.document));
          failed.delete(key);
          return false;
        } catch (error) {
          failed.set(keyOf(stored), error instanceof Error ? error : new Error(String(error)));
          return true;
        }
      });
      const stuck = left.length === pending.length;
      pending = left;
      if (pending.length === 0 || stuck) break;
    }
    return {
      restored: kept.length - pending.length,
      skipped: pending.map((stored) => ({
        id: stored.id,
        version: stored.version,
        error: failed.get(keyOf(stored))!,
      })),
    };
  }

  private async weaveFile(
    source: WeaveFile | string,
    index: WeaveIndex | undefined,
  ): Promise<WeaveFile> {
    if (typeof source !== 'string') return readWeave(source);
    if (source.includes('\n')) return weaveFromYaml(source);
    if (index === undefined) {
      throw new WeaveRefusedError(`"${source}" names a weave, but this fabric has no index`);
    }
    return index.resolve(source);
  }

  /** Every check first, then the publish: a refusal adds nothing. */
  private take(file: WeaveFile): CapabilityDefinition {
    if (file.id.startsWith('eve.')) {
      throw new WeaveRefusedError(`"${file.id}": eve.* is reserved for ${CORE_PACK_ID}`);
    }
    const key = `${file.id}@${file.version}`;
    if (
      this.added.has(key) ||
      this.catalog.has(capabilityId(file.id), capabilityVersion(file.version))
    ) {
      throw new WeaveRefusedError(`"${key}" is already here; a changed weave needs a new version`);
    }
    const weave = localWeave(file, this.catalog);
    const compiled = this.compile(weave.pipeline);
    if (!compiled.success || compiled.plan === undefined) {
      throw new PublishRefusedError(weave.pipeline.id, compiled.diagnostics);
    }
    const computed = describeWeave(
      weave,
      this.catalog,
      compiled.plan.authRequirements.scopes,
      file.verifiedAgainst,
    );
    for (const field of ['scopes', 'provides'] as const) {
      if (canonicalJson(computed[field]) !== canonicalJson(file[field])) {
        throw new WeaveMismatchError(field, file[field], computed[field]);
      }
    }
    const capability = this.publishComposite(weave.pipeline, weave.capability);
    this.added.set(`${file.id}@${file.version}`, file.digest);
    return capability;
  }

  /** A published composite as the weave it was published from. */
  private publishedWeave(id: string, version: string | undefined): Weave {
    const capability = this.catalog.get(
      capabilityId(id),
      version === undefined ? undefined : capabilityVersion(version),
    );
    const ref = capability.pipelineRef;
    const own = ref === undefined ? undefined : this.getPipeline(ref.id, ref.version);
    if (own === undefined) {
      throw new WeaveRefusedError(`"${id}" runs code of its own, so it travels in a pack`);
    }
    return {
      // Published under `${pipeline}@${capability}@${version}`; the weave carries the first.
      pipeline: { ...own, id: own.id.slice(0, own.id.indexOf('@')) },
      capability: {
        id,
        version: capability.version,
        name: capability.name,
        description: capability.description,
        ...(capability.attach === undefined
          ? {}
          : {
              attach: {
                on: capability.attach.on,
                as: capability.attach.as,
                subject: capability.attach.subject,
              },
            }),
      },
    };
  }

  /** Runs one capability on its own, its inputs given by port, as `as` if given. */
  async runOne(
    capability: CapabilityDefinition,
    inputs: Readonly<Record<string, unknown>>,
    as?: FabricIdentity,
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
    // A composite expands to the steps that run, so its ports are read where
    // the expanded pipeline says they are, not from a node named `one`.
    const { pipeline: expanded } = this.expand(pipeline);
    const result = await this.run(pipeline, inputs, as);
    const outputs: Record<string, unknown> = {};
    for (const output of expanded.outputs) {
      const value = readAt(result, output.source);
      if (value !== undefined) outputs[output.name] = value;
    }
    return outputs;
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

/** A record answer with only the fields a draft selected; as it is when it selected none. */
function narrowed(value: unknown, fields: readonly string[]): unknown {
  if (fields.length === 0 || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const record = value as Readonly<Record<string, unknown>>;
  return Object.fromEntries(fields.filter((f) => f in record).map((f) => [f, record[f]]));
}

/** The engine's view of an identity: a cache key, scopes, and ESI.ts's credentials. */
function callerOf(identity: FabricIdentity | undefined): Caller | undefined {
  if (identity === undefined) return undefined;
  return {
    key: `character:${identity.characterId}`,
    scopes: identity.scopes,
    credentials: identity.esi,
    characterId: identity.characterId,
  };
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
