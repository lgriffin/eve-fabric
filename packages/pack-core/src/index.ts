import { definePack } from '@eve-fabric/kit';
import { allCapabilities } from './capabilities/index.js';
import { coreTypes } from './types.js';

export * from './capabilities/index.js';
export * from './types.js';

/** The built-in capabilities and the eve.* types, each run beside its contract. */
export const corePack = definePack({
  id: '@eve-fabric/pack-core',
  types: coreTypes,
  capabilities: allCapabilities,
});
