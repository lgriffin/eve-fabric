import { definePack } from '@eve-fabric/kit';
import { allCapabilities } from './capabilities/index.js';

export * from './capabilities/index.js';

/** The built-in capabilities, each with its run beside its contract. */
export const corePack = definePack({ id: '@eve-fabric/pack-core', capabilities: allCapabilities });
