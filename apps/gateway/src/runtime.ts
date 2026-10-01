import type {
  CapabilityCatalog,
  ExecutionPlan,
  InMemoryFabricRegistry,
  StaticSource,
  TokenProvider,
} from '@eve-fabric/domain';
import type { GraphQLSchema } from 'graphql';
import { createEsi, type Esi } from '@lgriffin/esi.ts/client';
import { createFabric, type Fabric } from '@eve-fabric/fabric';
import type { Executor } from '@eve-fabric/executor';
import { corePack } from '@eve-fabric/pack-core';
import { DEFAULT_COMPATIBILITY_DATE } from '@eve-fabric/source-esi';
import { lazySdeDirectory, memoryStaticSource } from '@eve-fabric/source-sde';
import { InMemoryPipelineRepository } from '@eve-fabric/persistence';
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

  async rebuildRegistrations(): Promise<void> {
    const pipelines = await this.pipelineRepository.list();
    this.compiledRegistrations = [];
    for (const saved of pipelines) {
      // Composites expand first, so outputs read the inner steps that run.
      const expanded = this.fabric.expand(saved);
      const pipeline = expanded.diagnostics.length === 0 ? expanded.pipeline : saved;
      const base = { pipeline, catalog: this.catalog, includeProvenance: true as const };
      try {
        const result = this.fabric.compile(pipeline);
        this.compiledRegistrations.push(
          result.success
            ? { ...base, plan: result.plan as unknown as ExecutionPlan, executor: this.executor }
            : base,
        );
      } catch {
        // Pipeline failed to compile — still register for type introspection
        this.compiledRegistrations.push(base);
      }
    }
    this.invalidateGraphQLSchema();
  }
}
