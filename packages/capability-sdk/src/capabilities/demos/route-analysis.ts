import { defineCapability } from '../../define-capability.js';

export const routeAnalysis = defineCapability({
  id: 'demo.route.analysis',
  version: '1.0.0',
  name: 'Route Analysis',
  description: 'Analyse a route between two solar systems, calculating jump distance',
  inputs: {
    origin: { type: 'eve.system.reference', description: 'Origin solar system' },
    destination: { type: 'eve.system.reference', description: 'Destination solar system' },
  },
  outputs: {
    distance: { type: 'eve.route.distance', description: 'Jump count between systems' },
  },
  source: 'DERIVED',
  dependencies: ['route.distance'],
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 3600 },
  cost: { estimatedLatencyMs: 310, esiCallCount: 1 },
});
