import { defineCapability } from '../define-capability.js';

export const filter = defineCapability({
  id: 'collection.filter',
  version: '1.0.0',
  name: 'Filter Collection',
  description:
    'Filter market orders — remove orders that do not match criteria like price threshold, buy/sell type, or volume',
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
  description:
    'Sort market orders by price, volume, or other fields — organize and rank results for analysis',
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
  description:
    'Limit results to a specific count — take the top N cheapest, most expensive, or highest volume orders',
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
