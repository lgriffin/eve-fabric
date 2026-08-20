import { defineCapability } from '../define-capability.js';

export const orders = defineCapability({
  id: 'market.orders',
  version: '1.0.0',
  name: 'Market Orders',
  description: 'Fetch market orders for an item in a region',
  inputs: {
    region: { type: 'eve.region.reference', description: 'Target region' },
    item: { type: 'eve.type.reference', description: 'Item type to look up' },
  },
  outputs: {
    orders: { type: 'eve.market.order.collection', description: 'List of market orders' },
  },
  source: 'ESI',
  dependencies: ['universe.resolve.region', 'universe.resolve.type'],
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: true },
  cost: { estimatedLatencyMs: 500, esiCallCount: 1 },
});

export const aggregate = defineCapability({
  id: 'market.aggregate',
  version: '1.0.0',
  name: 'Aggregate Market Data',
  description: 'Calculate statistics — find lowest sell and highest buy prices',
  inputs: {
    orders: { type: 'eve.market.order.collection', description: 'Orders to aggregate' },
  },
  outputs: {
    lowestSell: { type: 'eve.currency.isk', description: 'Lowest sell price' },
    highestBuy: { type: 'eve.currency.isk', description: 'Highest buy price' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 5, esiCallCount: 0 },
});
