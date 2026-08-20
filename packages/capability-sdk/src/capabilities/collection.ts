import { defineCapability } from '../define-capability.js';

export const filter = defineCapability({
  id: 'collection.filter',
  version: '1.0.0',
  name: 'Filter Collection',
  description: "Filter them — remove items that don't match your conditions",
  inputs: {
    collection: { type: 'eve.market.order.collection', description: 'Collection to filter' },
    threshold: { type: 'eve.route.distance', description: 'Maximum value threshold' },
  },
  outputs: {
    result: { type: 'eve.market.order.collection', description: 'Filtered collection' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});

export const sort = defineCapability({
  id: 'collection.sort',
  version: '1.0.0',
  name: 'Sort Collection',
  description: 'Sort them — order results by price, volume, or other fields',
  inputs: {
    collection: { type: 'eve.market.order.collection', description: 'Collection to sort' },
  },
  outputs: {
    result: { type: 'eve.market.order.collection', description: 'Sorted collection' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});

export const limit = defineCapability({
  id: 'collection.limit',
  version: '1.0.0',
  name: 'Limit Collection',
  description: 'Take the top results — limit to a specific count',
  inputs: {
    collection: { type: 'eve.market.order.collection', description: 'Collection to limit' },
  },
  outputs: {
    result: { type: 'eve.market.order.collection', description: 'Limited collection' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});
