import type {
  CapabilityCatalog,
  ExecutionPlan,
  InMemoryFabricRegistry,
  StaticSource,
  Store,
  TokenProvider,
} from '@eve-fabric/core';
import type { GraphQLSchema } from 'graphql';
import { createEsi, type Esi } from '@lgriffin/esi.ts/client';
import { createFabric, type Fabric } from '@eve-fabric/fabric';
import type { Executor } from '@eve-fabric/executor';
import { corePack } from '@eve-fabric/pack-core';
import { DEFAULT_COMPATIBILITY_DATE } from '@eve-fabric/source-esi';
import { lazySdeDirectory, memoryStaticSource } from '@eve-fabric/source-sde';
import { InMemoryPipelineRepository, sqliteStore } from '@eve-fabric/persistence';
import { directoryIndex, type WeaveIndex } from '@eve-fabric/weave';
import type { PipelineRepository } from '@eve-fabric/persistence';
import { buildSchema as buildGraphQLSchema } from '@eve-fabric/graphql';
import type { PipelineRegistration } from '@eve-fabric/graphql';
import { seedDemoComposites } from './seed-demo.js';
import { EnvTokenProvider } from './auth/env-token-provider.js';

export { SdeLoadError } from '@eve-fabric/source-sde';

interface GatewayRuntimeConfig {
  readonly sdeDataPath?: string | undefined;
  /** ESI.ts's runtime. Defaults to one sending the fabric's user agent. */
  readonly esi?: Esi | undefined;
  /** The SDE, when not loaded from `sdeDataPath`. */
  readonly sde?: StaticSource | undefined;
  readonly tokenProvider?: TokenProvider | undefined;
  /** Where added weaves are kept. Defaults to SQLite at FABRIC_DB, or none. */
  readonly store?: Store | undefined;
  /** Where `id@range` weaves are found. Defaults to the directory at FABRIC_WEAVE_INDEX. */
  readonly index?: WeaveIndex | undefined;
}

function storeFor(config: GatewayRuntimeConfig | undefined): Store | undefined {
  if (config?.store !== undefined) return config.store;
  const path = process.env['FABRIC_DB'];
  return path ? sqliteStore(path) : undefined;
}

function indexFor(config: GatewayRuntimeConfig | undefined): WeaveIndex | undefined {
  if (config?.index !== undefined) return config.index;
  const path = process.env['FABRIC_WEAVE_INDEX'];
  return path ? directoryIndex(path) : undefined;
}

/** Who is calling ESI, as CCP asks every application to say. */
const DEFAULT_ESI_USER_AGENT = 'eve-fabric/0.1 (+https://github.com/lgriffin/eve-fabric)';

function staticSourceFor(config: GatewayRuntimeConfig | undefined): StaticSource {
  if (config?.sde !== undefined) return config.sde;
  const path = config?.sdeDataPath ?? process.env['SDE_DATA_PATH'];
  // A configured export that will not load fails loudly (FAB-SRC-01). With no
  // export configured, an explicitly empty SDE: every lookup reports "not found".
  return path ? lazySdeDirectory(path) : memoryStaticSource();
}

/**
 * The gateway's composition root: a fabric over ESI, the SDE and the core
 * pack, plus the gateway's own pipeline store and GraphQL schema.
 */
export class GatewayRuntime {
  readonly fabric: Fabric;
  readonly pipelineRepository: PipelineRepository;
  readonly tokenProvider: TokenProvider;

  private _graphqlSchema: GraphQLSchema | undefined;
  private compiledRegistrations: PipelineRegistration[] = [];
  private unpublishedPipelines = new Map<string, readonly string[]>();

  constructor(config?: GatewayRuntimeConfig) {
    const esi =
      config?.esi ??
      createEsi({
        userAgent: process.env['ESI_USER_AGENT'] ?? DEFAULT_ESI_USER_AGENT,
        compatibilityDate: DEFAULT_COMPATIBILITY_DATE,
      });
    this.fabric = createFabric({
      esi,
      esiCompatibilityDate: DEFAULT_COMPATIBILITY_DATE,
      sde: staticSourceFor(config),
      packs: [corePack],
      store: storeFor(config),
      index: indexFor(config),
    });
    seedDemoComposites(this.fabric);

    this.pipelineRepository = new InMemoryPipelineRepository();
    this.tokenProvider = config?.tokenProvider ?? new EnvTokenProvider();
  }

  get registry(): InMemoryFabricRegistry {
    return this.fabric.registry;
  }

  get catalog(): CapabilityCatalog {
    return this.fabric.catalog;
  }

  get executor(): Executor {
    return this.fabric.executor;
  }

  get graphqlSchema(): GraphQLSchema {
    if (!this._graphqlSchema) {
      this._graphqlSchema = buildGraphQLSchema(this.compiledRegistrations);
    }
    return this._graphqlSchema;
  }

  invalidateGraphQLSchema(): void {
    this._graphqlSchema = undefined;
  }

  /** Saved pipelines that are not published, by id, with why: the errors that stop them compiling. */
  get unpublished(): ReadonlyMap<string, readonly string[]> {
    return this.unpublishedPipelines;
  }

  async rebuildRegistrations(): Promise<void> {
    const pipelines = await this.pipelineRepository.list();
    this.compiledRegistrations = [];
    this.unpublishedPipelines = new Map();
    const errors = (diagnostics: readonly { severity: string; message: string }[]) =>
      diagnostics.filter((d) => d.severity === 'error').map((d) => d.message);
    for (const saved of pipelines) {
      // Composites expand first, so outputs read the inner steps that run.
      const expanded = this.fabric.expand(saved);
      if (errors(expanded.diagnostics).length > 0) {
        this.unpublishedPipelines.set(saved.id, errors(expanded.diagnostics));
        continue;
      }
      const result = this.fabric.compile(expanded.pipeline);
      // Only a pipeline that compiles is published; a saved draft that does
      // not stays saved, and says why, but is not a field anyone can query.
      if (!result.success || result.plan === undefined) {
        this.unpublishedPipelines.set(saved.id, errors(result.diagnostics));
        continue;
      }
      this.compiledRegistrations.push({
        pipeline: expanded.pipeline,
        catalog: this.catalog,
        includeProvenance: true,
        plan: result.plan as unknown as ExecutionPlan,
        executor: this.executor,
      });
    }
    this.invalidateGraphQLSchema();
  }
}
