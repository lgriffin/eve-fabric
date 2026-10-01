import type {
  CapabilityDefinition,
  CapabilityRef,
  CapabilityRun,
  CapabilityUse,
  Clock,
  SemanticPort,
  SemanticTypeDefinition,
} from '@eve-fabric/domain';
import {
  capabilityId,
  capabilityVersion,
  isCapabilityUse,
  scopesFromUses,
  sourceFromUses,
} from '@eve-fabric/domain';
import type { PublicScopeTree, ScopeTree } from '@lgriffin/esi.ts/client';
import type { IStaticDataProvider } from '@lgriffin/esi.ts/sde';
import { typeIdOf, type TypeRef } from './define-type.js';

/** One port of a capability: its semantic type, by id or definition. */
export interface PortConfig {
  readonly type: TypeRef;
  readonly description?: string | undefined;
  /** Inputs only. Defaults to true. */
  readonly required?: boolean | undefined;
  /** Inputs only. The port also takes a name, which `run` looks up. */
  readonly acceptsName?: boolean | undefined;
}

export type PortsConfig = Readonly<Record<string, PortConfig>>;

/** How long a cacheable capability's results keep when it names no TTL. */
const DEFAULT_TTL_SECONDS = 300;

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
  /**
   * Hang the capability on a type as a field: `{ on: 'eve.type', as:
   * 'orders', subject: 'item' }` makes a type's orders one move away, fed
   * through the `item` input.
   */
  readonly attach?:
    { readonly on: TypeRef; readonly as: string; readonly subject: keyof I & string } | undefined;
  readonly run: (
    inputs: InputValues<I>,
    context: ContextFor<U>,
  ) => OutputValues<O> | Promise<OutputValues<O>>;
}

function toPorts(record: PortsConfig, isInput: boolean): ReadonlyMap<string, SemanticPort> {
  const map = new Map<string, SemanticPort>();
  for (const [name, config] of Object.entries(record)) {
    const port: SemanticPort = {
      name,
      semanticType: typeIdOf(config.type),
      description: config.description,
      required: isInput ? (config.required ?? true) : true,
    };
    map.set(name, isInput && config.acceptsName === true ? { ...port, acceptsName: true } : port);
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
  if (config.attach !== undefined && !(config.attach.subject in config.inputs)) {
    throw new Error(
      `Capability "${config.id}" attaches through "${config.attach.subject}", which is not one of its inputs`,
    );
  }
  const scopes = scopesFromUses(uses);
  const source = sourceFromUses(uses);
  const cacheable = config.cache?.cacheable ?? source !== 'DERIVED';
  const dependencies: readonly CapabilityRef[] = (config.dependencies ?? []).map((id) => ({
    id: capabilityId(id),
  }));

  const definition: CapabilityDefinition = {
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
      cacheable,
      // A cacheable capability that names no TTL keeps results five minutes.
      defaultTtlSeconds: config.cache?.defaultTtlSeconds ?? (cacheable ? DEFAULT_TTL_SECONDS : 0),
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
    attach:
      config.attach === undefined
        ? undefined
        : {
            on: typeIdOf(config.attach.on),
            as: config.attach.as,
            subject: config.attach.subject,
          },
  };
  portTypes.set(definition, definitionsIn(config));
  return definition;
}

/** Type definitions a capability names by object, so its pack can collect them. */
const portTypes = new WeakMap<CapabilityDefinition, readonly SemanticTypeDefinition[]>();

export function typesUsedBy(capability: CapabilityDefinition): readonly SemanticTypeDefinition[] {
  return portTypes.get(capability) ?? [];
}

function definitionsIn(config: {
  readonly inputs: PortsConfig;
  readonly outputs: PortsConfig;
  readonly attach?: { readonly on: TypeRef } | undefined;
}): SemanticTypeDefinition[] {
  const refs: TypeRef[] = [
    ...Object.values(config.inputs).map((p) => p.type),
    ...Object.values(config.outputs).map((p) => p.type),
  ];
  if (config.attach !== undefined) refs.push(config.attach.on);
  return refs.filter((ref): ref is SemanticTypeDefinition => typeof ref !== 'string');
}
