import type { CapabilityId, CapabilityVersion, CapabilityRef } from './capability-id.js';
import type { AuthRequirement, CachePolicy, CostModel, CapabilitySource } from './value-objects.js';
import type { SemanticPort } from './semantic-port.js';
import type { Clock } from '../ports/clock.js';
import type { SemanticTypeId } from '../semantic-type/semantic-type.js';

export interface PipelineRef {
  readonly id: string;
  readonly version: number;
}

/**
 * What a capability's `run` reaches outside itself. The fabric derives the
 * capability's source, scopes and run context from this list.
 *
 * - `esi.public`: ESI operations that need no scope
 * - `esi:<scope>`: ESI operations as the calling identity, needing that scope
 * - `sde`: the static data export
 *
 * A capability that uses nothing is DERIVED: pure, safe to memoise.
 */
export type CapabilityUse = 'esi.public' | `esi:${string}` | 'sde';

/**
 * What `run` receives besides its inputs. The core does not know ESI.ts's
 * types, so `esi` and `sde` are opaque here; `@eve-fabric/kit` types them
 * from the capability's `uses`.
 */
export interface RunContext {
  readonly clock: Clock;
  /** ESI.ts's public scope tree, or an identity's view, when `uses` names ESI. */
  readonly esi?: unknown;
  /** ESI.ts's `IStaticDataProvider`, when `uses` names `sde`. */
  readonly sde?: unknown;
}

/** Port values in, port values out, keyed by port name. */
export type CapabilityRun = (
  inputs: Readonly<Record<string, unknown>>,
  context: RunContext,
) => Readonly<Record<string, unknown>> | Promise<Readonly<Record<string, unknown>>>;

/**
 * Where a capability hangs in the type graph: a field named `as` on the
 * `on` type, fed through the input port `subject`. `market.orders` attaches
 * to `eve.type` as `orders`, so a type's orders are one move away.
 */
export interface CapabilityAttach {
  readonly on: SemanticTypeId;
  readonly as: string;
  readonly subject: string;
}

export interface CapabilityDefinition {
  readonly id: CapabilityId;
  readonly version: CapabilityVersion;
  readonly name: string;
  readonly description: string;
  readonly inputs: ReadonlyMap<string, SemanticPort>;
  readonly outputs: ReadonlyMap<string, SemanticPort>;
  /** Derived from `uses` for capabilities defined with `@eve-fabric/kit`. */
  readonly source: CapabilitySource;
  readonly dependencies: readonly CapabilityRef[];
  readonly auth: AuthRequirement;
  readonly cache: CachePolicy;
  readonly cost: CostModel;
  readonly pipelineRef?: PipelineRef | undefined;
  /** What `run` reaches; see {@link CapabilityUse}. */
  readonly uses?: readonly CapabilityUse[] | undefined;
  /** The code behind the contract. Required to register in an executable catalog. */
  readonly run?: CapabilityRun | undefined;
  /** See {@link CapabilityAttach}. */
  readonly attach?: CapabilityAttach | undefined;
}
