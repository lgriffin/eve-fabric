import { defineCapability } from '../define-capability.js';

export const filter = defineCapability({
  id: 'collection.filter',
  version: 1,
  name: 'Filter Collection',
  description: 'Filter a collection by a numeric threshold predicate',
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
  version: 1,
  name: 'Sort Collection',
  description: 'Sort a collection by a field in ascending or descending order',
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
  version: 1,
  name: 'Limit Collection',
  description: 'Take the first N items from a collection',
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
