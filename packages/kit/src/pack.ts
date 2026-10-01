import type { CapabilityDefinition } from '@eve-fabric/domain';

/**
 * A pack: an npm package of capabilities, installed by whoever operates the
 * fabric. Packs carry code; weaves carry data (constitution IX).
 */
export interface Pack {
  /** The npm name or a namespaced id, for diagnostics. */
  readonly id: string;
  readonly capabilities: readonly CapabilityDefinition[];
}

export function definePack(config: {
  readonly id: string;
  readonly capabilities: readonly CapabilityDefinition[];
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
  return { id: config.id, capabilities: config.capabilities };
}
