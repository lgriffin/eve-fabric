import { defineCapability } from '../../define-capability.js';

export const haulingCost = defineCapability({
  id: 'demo.hauling.cost',
  version: '1.0.0',
  name: 'Hauling Cost',
  description: 'Estimate hauling cost based on route distance and cargo volume',
  inputs: {
    origin: { type: 'eve.system.reference', description: 'Origin solar system' },
    destination: { type: 'eve.system.reference', description: 'Destination solar system' },
    volume: { type: 'eve.currency.isk', description: 'Collateral / cargo value in ISK' },
  },
  outputs: {
    cost: { type: 'eve.currency.isk', description: 'Estimated hauling cost in ISK' },
    distance: { type: 'eve.route.distance', description: 'Jump count for the route' },
  },
  source: 'DERIVED',
  dependencies: ['route.distance'],
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 3600 },
  cost: { estimatedLatencyMs: 320, esiCallCount: 1 },
});
