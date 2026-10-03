import type {
  CapabilityCatalog,
  InMemoryFabricRegistry,
  StaticSource,
  Store,
  TokenProvider,
} from '@eve-fabric/core';
import { createEsi, type Esi } from '@lgriffin/esi.ts/client';
import { createFabric, type Fabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { DEFAULT_COMPATIBILITY_DATE } from '@eve-fabric/source-esi';
import { lazySdeDirectory, memoryStaticSource } from '@eve-fabric/source-sde';
import { sqliteStore } from '@eve-fabric/persistence';
import { directoryIndex, type WeaveIndex } from '@eve-fabric/weave';
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
 * pack. The GraphQL schema is the fabric's own, derived from what is installed.
 */
export class GatewayRuntime {
  readonly fabric: Fabric;
  readonly tokenProvider: TokenProvider;

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

    this.tokenProvider = config?.tokenProvider ?? new EnvTokenProvider();
  }

  get registry(): InMemoryFabricRegistry {
    return this.fabric.registry;
  }

  get catalog(): CapabilityCatalog {
    return this.fabric.catalog;
  }

  get executor(): Fabric['executor'] {
    return this.fabric.executor;
  }
}
