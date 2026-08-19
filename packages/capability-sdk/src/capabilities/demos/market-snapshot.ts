import { defineCapability } from '../../define-capability.js';

export const marketSnapshot = defineCapability({
  id: 'demo.market.snapshot',
  version: '1.0.0',
  name: 'Market Snapshot',
  description:
    'Fetch and aggregate market orders for an item in a region, returning current prices',
  inputs: {
    item: { type: 'eve.type.reference', description: 'Item type to look up' },
    region: { type: 'eve.region.reference', description: 'Target region' },
  },
  outputs: {
    orders: { type: 'eve.market.order.collection', description: 'List of market orders' },
    lowestSell: { type: 'eve.currency.isk', description: 'Lowest sell price' },
    highestBuy: { type: 'eve.currency.isk', description: 'Highest buy price' },
  },
  source: 'DERIVED',
  dependencies: ['market.orders', 'market.aggregate'],
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 300 },
  cost: { estimatedLatencyMs: 510, esiCallCount: 1 },
});
