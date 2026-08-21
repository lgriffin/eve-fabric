import { defineCapability } from '../define-capability.js';

export const manufacturingCost = defineCapability({
  id: 'industry.manufacturing.cost',
  version: '1.0.0',
  name: 'Manufacturing Cost',
  description:
    'Estimate total manufacturing cost for an item — calculates material prices in a region to determine build cost',
  inputs: {
    item: { type: 'eve.type.reference', description: 'Item to manufacture' },
    region: { type: 'eve.region.reference', description: 'Region for material prices' },
  },
  outputs: {
    totalCost: { type: 'eve.currency.isk', description: 'Total estimated build cost' },
  },
  source: 'DERIVED',
  dependencies: ['market.orders', 'universe.resolve.type'],
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 300 },
  cost: { estimatedLatencyMs: 1000, esiCallCount: 5 },
});

export const manufacturingProfit = defineCapability({
  id: 'industry.manufacturing.profit',
  version: '1.0.0',
  name: 'Manufacturing Profit',
  description:
    'Calculate manufacturing profit margin — compare build cost against market sell price to find profitable items to produce',
  inputs: {
    item: { type: 'eve.type.reference', description: 'Item to evaluate' },
    region: { type: 'eve.region.reference', description: 'Region for pricing' },
  },
  outputs: {
    profit: { type: 'eve.currency.isk', description: 'Profit per unit' },
    margin: { type: 'eve.percentage', description: 'Profit margin percentage' },
  },
  source: 'DERIVED',
  dependencies: ['industry.manufacturing.cost', 'market.orders', 'market.aggregate'],
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 300 },
  cost: { estimatedLatencyMs: 1500, esiCallCount: 6 },
});

export const blueprintLookup = defineCapability({
  id: 'industry.blueprint.lookup',
  version: '1.0.0',
  name: 'Blueprint Lookup',
  description:
    'Look up a blueprint for an item — find what materials and skills are needed for manufacturing',
  inputs: {
    item: { type: 'eve.type.reference', description: 'Item type to find blueprint for' },
  },
  outputs: {
    blueprint: { type: 'eve.type.reference', description: 'Blueprint type ID' },
  },
  source: 'SDE',
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 86400, stalePermitted: true },
  cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
});

export const reprocessingYield = defineCapability({
  id: 'industry.reprocessing.yield',
  version: '1.0.0',
  name: 'Reprocessing Yield',
  description:
    'Calculate reprocessing output — determine what minerals and materials you get from refining an item',
  inputs: {
    item: { type: 'eve.type.reference', description: 'Item to reprocess' },
    quantity: { type: 'eve.quantity', description: 'Number of items to reprocess' },
  },
  outputs: {
    value: { type: 'eve.currency.isk', description: 'Estimated ISK value of refined materials' },
  },
  source: 'DERIVED',
  dependencies: ['universe.resolve.type'],
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 3600 },
  cost: { estimatedLatencyMs: 50, esiCallCount: 0 },
});
