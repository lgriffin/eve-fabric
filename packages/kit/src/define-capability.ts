import type {
  CapabilityDefinition,
  CapabilityRef,
  CapabilityRun,
  CapabilityUse,
  Clock,
  SemanticPort,
} from '@eve-fabric/domain';
import {
  capabilityId,
  capabilityVersion,
  isCapabilityUse,
  scopesFromUses,
  semanticTypeId,
  sourceFromUses,
} from '@eve-fabric/domain';
import type { PublicScopeTree, ScopeTree } from '@lgriffin/esi.ts/client';
import type { IStaticDataProvider } from '@lgriffin/esi.ts/sde';

/** One port of a capability, by semantic type id. */
export interface PortConfig {
  readonly type: string;
  readonly description?: string | undefined;
  /** Inputs only. Defaults to true. */
  readonly required?: boolean | undefined;
}

export type PortsConfig = Readonly<Record<string, PortConfig>>;

type HasUse<U, M> = [Extract<U, M>] extends [never] ? false : true;

/**
 * The context `run` receives, typed from `uses`: a capability that did not
 * declare `sde` has no `sde` to reach, and one that uses an ESI scope gets
 * the calling identity's view rather than the public one.
 */
export type ContextFor<U extends CapabilityUse> = { readonly clock: Clock } & (HasUse<
  U,
  `esi:${string}`
> extends true
  ? { readonly esi: ScopeTree }
  : HasUse<U, 'esi.public'> extends true
    ? { readonly esi: PublicScopeTree }
    : unknown) &
  (HasUse<U, 'sde'> extends true ? { readonly sde: IStaticDataProvider } : unknown);

/** Input values by port name. Optional ports may be absent. */
export type InputValues<I extends PortsConfig> = {
  readonly [K in keyof I]: I[K]['required'] extends false ? unknown : unknown;
};

/** Every output port must be returned. */
export type OutputValues<O extends PortsConfig> = { readonly [K in keyof O]: unknown };

export interface CapabilityConfig<
  I extends PortsConfig,
  O extends PortsConfig,
  U extends CapabilityUse = never,
> {
  readonly id: string;
  readonly version: string | number;
  readonly name: string;
  readonly description: string;
  readonly inputs: I;
  readonly outputs: O;
  /**
   * What `run` reaches. The source (ESI, SDE or DERIVED), the scopes and the
   * run context are all derived from this. Leave it out for a pure capability.
   */
  readonly uses?: readonly U[] | undefined;
  readonly dependencies?: readonly string[] | undefined;
  readonly cache?:
    | {
        readonly cacheable?: boolean | undefined;
        readonly defaultTtlSeconds?: number | undefined;
        readonly stalePermitted?: boolean | undefined;
      }
    | undefined;
  readonly cost?:
    | {
        readonly estimatedLatencyMs?: number | undefined;
        readonly esiCallCount?: number | undefined;
      }
    | undefined;
  readonly run: (
    inputs: InputValues<I>,
    context: ContextFor<U>,
  ) => OutputValues<O> | Promise<OutputValues<O>>;
}

function toPorts(record: PortsConfig, isInput: boolean): ReadonlyMap<string, SemanticPort> {
  const map = new Map<string, SemanticPort>();
  for (const [name, config] of Object.entries(record)) {
    map.set(name, {
      name,
      semanticType: semanticTypeId(config.type),
      description: config.description,
      required: isInput ? (config.required ?? true) : true,
    });
  }
  return map;
}

/**
 * A capability: its contract and the code that implements it, in one module
 * (constitution V). The result registers in an executable catalog.
 */
export function defineCapability<
  const I extends PortsConfig,
  const O extends PortsConfig,
  const U extends CapabilityUse = never,
>(config: CapabilityConfig<I, O, U>): CapabilityDefinition {
  const uses: readonly CapabilityUse[] = config.uses ?? [];
  for (const use of uses) {
    if (!isCapabilityUse(use)) {
      throw new Error(
        `Capability "${config.id}" declares an unknown use "${use as string}"; expected esi.public, esi:<scope> or sde`,
      );
    }
  }
  if (Object.keys(config.outputs).length === 0) {
    throw new Error(`Capability "${config.id}" must declare at least one output`);
  }
  const scopes = scopesFromUses(uses);
  const source = sourceFromUses(uses);
  const dependencies: readonly CapabilityRef[] = (config.dependencies ?? []).map((id) => ({
    id: capabilityId(id),
  }));

  return {
    id: capabilityId(config.id),
    version: capabilityVersion(config.version),
    name: config.name,
    description: config.description,
    inputs: toPorts(config.inputs, true),
    outputs: toPorts(config.outputs, false),
    source,
    dependencies,
    auth: { required: scopes.length > 0, scopes },
    cache: {
      cacheable: config.cache?.cacheable ?? source !== 'DERIVED',
      defaultTtlSeconds: config.cache?.defaultTtlSeconds ?? 0,
      stalePermitted: config.cache?.stalePermitted ?? false,
      identityInKey: scopes.length > 0,
    },
    cost: {
      estimatedLatencyMs: config.cost?.estimatedLatencyMs ?? 0,
      esiCallCount: config.cost?.esiCallCount ?? (source === 'ESI' ? 1 : 0),
    },
    uses,
    // The typed run is narrower than the core's opaque signature; the
    // executor builds the context from the same `uses`, so the cast holds.
    run: config.run as unknown as CapabilityRun,
  };
}
