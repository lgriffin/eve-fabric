import { GatewayError, InMemoryFabricRegistry } from '@eve-fabric/domain';
import type {
  CapabilityCatalog,
  CapabilityDefinition,
  ExecutionPlan,
  SourceAdapter,
  SourceAdapterResult,
  TokenProvider,
} from '@eve-fabric/domain';
import type { GraphQLSchema } from 'graphql';
import type { EsiClient } from '@lgriffin/esi.ts';
import type { IStaticDataProvider } from '@lgriffin/esi.ts/sde';
import { EsiAdapter } from '@eve-fabric/esi-adapter';
import { SdeAdapter } from '@eve-fabric/sde-adapter';
import { Executor, DerivedAdapter } from '@eve-fabric/executor';
import { MemoryCache } from '@eve-fabric/cache';
import { InMemoryPipelineRepository } from '@eve-fabric/persistence';
import type { PipelineRepository } from '@eve-fabric/persistence';
import { compile } from '@eve-fabric/compiler';
import { buildSchema as buildGraphQLSchema } from '@eve-fabric/graphql';
import type { PipelineRegistration } from '@eve-fabric/graphql';
import { seedPrebuiltCapabilities } from './seed-capabilities.js';
import { seedDemoCapabilities } from './seed-demo.js';
import { EnvTokenProvider } from './auth/env-token-provider.js';

interface GatewayRuntimeConfig {
  readonly sdeDataPath?: string | undefined;
  readonly esiClient?: EsiClient | undefined;
  readonly tokenProvider?: TokenProvider | undefined;
}

class LazySdeAdapter implements SourceAdapter {
  readonly name = 'SDE';
  private resolvedAdapter: SdeAdapter | undefined;
  private adapterPromise: Promise<SdeAdapter> | undefined;
  private readonly sdeDataPath: string | undefined;

  constructor(sdeDataPath?: string) {
    this.sdeDataPath = sdeDataPath;
  }

  supports(capability: CapabilityDefinition): boolean {
    return capability.source === 'SDE';
  }

  async execute(
    capability: CapabilityDefinition,
    inputs: ReadonlyMap<string, unknown>,
  ): Promise<SourceAdapterResult> {
    if (this.resolvedAdapter === undefined) {
      this.adapterPromise ??= createSdeProvider(this.sdeDataPath).then(
        (provider) => new SdeAdapter({ provider }),
      );
      this.resolvedAdapter = await this.adapterPromise;
    }
    return this.resolvedAdapter.execute(capability, inputs);
  }
}

/**
 * Thrown when a configured SDE export cannot be loaded. Never replaced by an
 * empty provider. A source failure, so API clients see GATEWAY_SOURCE_UNAVAILABLE;
 * the path stays server-side (on the error and in the logged cause).
 */
export class SdeLoadError extends GatewayError {
  readonly code = 'GATEWAY_SOURCE_UNAVAILABLE' as const;
  readonly category = 'runtime' as const;
  readonly context = { source: 'SDE' as const };
  readonly path: string;

  constructor(path: string, cause: unknown) {
    super('SDE source unavailable: the configured export could not be loaded');
    this.cause = cause;
    this.path = path;
  }
}

async function createSdeProvider(sdeDataPath?: string): Promise<IStaticDataProvider> {
  if (sdeDataPath) {
    try {
      const sdeModule = (await import('@lgriffin/esi.ts/sde')) as {
        SdeDataProvider: { fromDirectory: (path: string) => IStaticDataProvider };
      };
      return sdeModule.SdeDataProvider.fromDirectory(sdeDataPath);
    } catch (err) {
      // Constitution XII: a configured source that fails is an error, not an empty source.
      throw new SdeLoadError(sdeDataPath, err);
    }
  }
  // No SDE configured: an explicitly empty provider, so every lookup reports "not found".
  const memoryModule = (await import('@lgriffin/esi.ts/sde/memory')) as {
    MemorySdeProvider: new () => IStaticDataProvider;
  };
  return new memoryModule.MemorySdeProvider();
}

export class GatewayRuntime {
  readonly registry: InMemoryFabricRegistry;
  readonly catalog: CapabilityCatalog;
  readonly pipelineRepository: PipelineRepository;
  readonly cache: MemoryCache;
  readonly executor: Executor;
  readonly tokenProvider: TokenProvider;
  readonly esiAdapter: EsiAdapter;
  readonly derivedAdapter: DerivedAdapter;

  private _graphqlSchema: GraphQLSchema | undefined;
  private compiledRegistrations: PipelineRegistration[] = [];

  constructor(config?: GatewayRuntimeConfig) {
    this.registry = new InMemoryFabricRegistry();
    seedPrebuiltCapabilities(this.registry);
    seedDemoCapabilities(this.registry);

    this.catalog = this.registry.getCatalog();
    this.pipelineRepository = new InMemoryPipelineRepository();
    this.cache = new MemoryCache();
    this.tokenProvider = config?.tokenProvider ?? new EnvTokenProvider();

    // Without a client, the adapter builds one with the fabric's user agent,
    // the same one generated pipelines get; ESI_USER_AGENT overrides it here.
    this.esiAdapter =
      config?.esiClient === undefined
        ? new EsiAdapter({ userAgent: process.env['ESI_USER_AGENT'] })
        : new EsiAdapter({ client: config.esiClient });
    this.derivedAdapter = new DerivedAdapter();

    const sdeDataPath = config?.sdeDataPath ?? process.env['SDE_DATA_PATH'];
    const lazySdeAdapter = new LazySdeAdapter(sdeDataPath);

    this.executor = new Executor({
      adapters: [this.esiAdapter, lazySdeAdapter, this.derivedAdapter],
      catalog: this.catalog,
      cache: this.cache,
    });
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

  async rebuildRegistrations(): Promise<void> {
    const pipelines = await this.pipelineRepository.list();
    this.compiledRegistrations = [];
    for (const pipeline of pipelines) {
      try {
        const result = compile(pipeline, this.catalog);
        const base = { pipeline, catalog: this.catalog, includeProvenance: true as const };
        const reg: PipelineRegistration = result.success
          ? { ...base, plan: result.plan as unknown as ExecutionPlan, executor: this.executor }
          : base;
        this.compiledRegistrations.push(reg);
      } catch {
        // Pipeline failed to compile — still register for type introspection
        this.compiledRegistrations.push({
          pipeline,
          catalog: this.catalog,
          includeProvenance: true,
        });
      }
    }
    this.invalidateGraphQLSchema();
  }
}
