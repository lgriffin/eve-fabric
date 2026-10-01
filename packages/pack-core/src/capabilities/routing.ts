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
  attach: { on: 'eve.system', as: 'jumpsTo', subject: 'origin' },
  uses: ['esi.public'],
  cost: { estimatedLatencyMs: 300 },
  async run({ origin, destination }, { esi }) {
    const { route } = await esi
      .route(requireId(origin, 'origin'), requireId(destination, 'destination'))
      .post({});
    return { distance: route.length > 0 ? route.length - 1 : 0 };
  },
});

export const routePlan = defineCapability({
  id: 'route.plan',
  version: '2.0.0',
  name: 'Route',
  description: 'The systems on the shortest route between two solar systems, in order',
  inputs: {
    origin: { type: 'eve.system.reference', description: 'Origin system' },
    destination: { type: 'eve.system.reference', description: 'Destination system' },
  },
  outputs: {
    route: { type: 'eve.system.reference.collection', description: 'Systems, origin first' },
  },
  attach: { on: 'eve.system', as: 'route', subject: 'origin' },
  uses: ['esi.public'],
  cost: { estimatedLatencyMs: 300 },
  async run({ origin, destination }, { esi }) {
    const { route } = await esi
      .route(requireId(origin, 'origin'), requireId(destination, 'destination'))
      .post({});
    return { route: [...route] };
  },
});

interface SystemRecord {
  readonly system_id: number;
  readonly security_status: number;
}

export const routeSafety = defineCapability({
  id: 'route.safety',
  version: '2.0.0',
  name: 'Route Safety',
  description: 'How many jumps a route takes and the least secure system on it',
  inputs: {
    systems: { type: 'eve.system.collection', description: 'The systems on a route, in order' },
  },
  outputs: {
    safety: { type: 'eve.route.safety', description: 'Jumps and the lowest security' },
  },
  attach: { on: 'eve.system.collection', as: 'lowest security', subject: 'systems' },
  cost: { estimatedLatencyMs: 1 },
  run({ systems }) {
    const list = systems as SystemRecord[];
    const [first] = list;
    if (first === undefined) return { safety: null };
    const lowest = list.reduce(
      (low, s) => (s.security_status < low.security_status ? s : low),
      first,
    );
    return {
      safety: {
        jumps: list.length - 1,
        security_status: lowest.security_status,
        system_id: lowest.system_id,
      },
    };
  },
});
