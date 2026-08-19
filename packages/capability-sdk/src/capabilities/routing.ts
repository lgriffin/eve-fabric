import { defineCapability } from '../define-capability.js';

export const distance = defineCapability({
  id: 'route.distance',
  version: '1.0.0',
  name: 'Route Distance',
  description: 'Calculate jump distance between two solar systems',
  inputs: {
    origin: { type: 'eve.system.reference', description: 'Origin system' },
    destination: { type: 'eve.system.reference', description: 'Destination system' },
  },
  outputs: {
    distance: { type: 'eve.route.distance', description: 'Jump count' },
  },
  source: 'ESI',
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 3600 },
  cost: { estimatedLatencyMs: 300, esiCallCount: 1 },
});
