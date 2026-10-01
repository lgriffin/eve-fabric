import { defineCapability } from '@eve-fabric/kit';
import { requireId } from '../support.js';

export const distance = defineCapability({
  id: 'route.distance',
  version: '2.0.0',
  name: 'Route Distance',
  description:
    'Calculate route and jump distance between two solar systems — find how far apart systems are for travel or hauling',
  inputs: {
    origin: { type: 'eve.system.reference', description: 'Origin system' },
    destination: { type: 'eve.system.reference', description: 'Destination system' },
  },
  outputs: {
    distance: { type: 'eve.route.distance', description: 'Jump count' },
  },
  uses: ['esi.public'],
  cost: { estimatedLatencyMs: 300 },
  async run({ origin, destination }, { esi }) {
    const { route } = await esi
      .route(requireId(origin, 'origin'), requireId(destination, 'destination'))
      .post({});
    return { distance: route.length > 0 ? route.length - 1 : 0 };
  },
});
