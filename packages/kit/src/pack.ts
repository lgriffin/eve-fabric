import type {
  CapabilityDefinition,
  PipelineDefinition,
  SemanticTypeDefinition,
} from '@eve-fabric/domain';
import { typesUsedBy } from './define-capability.js';
import { typesMentionedBy } from './define-type.js';

/**
 * A pipeline a pack publishes as a capability when it is installed: a join
 * of other capabilities, carried as data. It compiles against the fabric it
 * is installed in, or the install is refused.
 */
export interface Weave {
  readonly pipeline: PipelineDefinition;
  readonly capability: {
    readonly id: string;
    readonly version: string;
    readonly name: string;
    readonly description: string;
    readonly attach?:
      { readonly on: string; readonly as: string; readonly subject: string } | undefined;
  };
}

/**
 * A pack: an npm package of capabilities and the semantic types they use,
 * installed by whoever operates the fabric. Packs carry code; weaves carry
 * data (constitution IX).
 */
export interface Pack {
  /** The npm name or a namespaced id, for diagnostics. */
  readonly id: string;
  /** The types the pack defines; a pack may use only types another pack installs. */
  readonly types?: readonly SemanticTypeDefinition[] | undefined;
  readonly capabilities: readonly CapabilityDefinition[];
  /** Pipelines published as capabilities once the capabilities are in. */
  readonly weaves?: readonly Weave[] | undefined;
}

/** The given types plus every type they or the capabilities name by object. */
function collectTypes(
  packId: string,
  types: readonly SemanticTypeDefinition[],
  capabilities: readonly CapabilityDefinition[],
): SemanticTypeDefinition[] {
  const byId = new Map<string, SemanticTypeDefinition>();
  const pending = [...types, ...capabilities.flatMap(typesUsedBy)];
  while (pending.length > 0) {
    const type = pending.pop()!;
    const known = byId.get(type.id);
    if (known === type) continue;
    if (known !== undefined) {
      throw new Error(`Pack "${packId}" defines semantic type "${type.id as string}" twice`);
    }
    byId.set(type.id, type);
    pending.push(...typesMentionedBy(type));
  }
  return [...byId.values()];
}

export function definePack(config: {
  readonly id: string;
  /** Types the pack defines. Types its capabilities name by object are collected too. */
  readonly types?: readonly SemanticTypeDefinition[] | undefined;
  readonly capabilities: readonly CapabilityDefinition[];
  readonly weaves?: readonly Weave[] | undefined;
}): Pack {
  const seen = new Set<string>();
  for (const capability of config.capabilities) {
    const key = `${capability.id as string}@${capability.version as string}`;
    if (seen.has(key)) {
      throw new Error(`Pack "${config.id}" lists ${key} twice`);
    }
    if (typeof capability.run !== 'function') {
      throw new Error(
        `Pack "${config.id}" lists "${capability.id as string}" with no run function (FAB-VAL-01)`,
      );
    }
    seen.add(key);
  }
  return {
    id: config.id,
    types: collectTypes(config.id, config.types ?? [], config.capabilities),
    capabilities: config.capabilities,
    ...(config.weaves === undefined ? {} : { weaves: config.weaves }),
  };
}
