import { defineCapability } from '../define-capability.js';

export const freightEstimate = defineCapability({
  id: 'logistics.freight.estimate',
  version: '1.0.0',
  name: 'Freight Estimate',
  description:
    'Estimate freight and hauling cost between two systems — calculate shipping costs based on jump distance and collateral value',
  inputs: {
    origin: { type: 'eve.system.reference', description: 'Origin system' },
    destination: { type: 'eve.system.reference', description: 'Destination system' },
    collateral: {
      type: 'eve.currency.isk',
      description: 'Cargo value for collateral calculation',
    },
  },
  outputs: {
    cost: { type: 'eve.currency.isk', description: 'Estimated shipping cost' },
    distance: { type: 'eve.route.distance', description: 'Route jump count' },
  },
  source: 'DERIVED',
  dependencies: ['route.distance'],
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 3600 },
  cost: { estimatedLatencyMs: 320, esiCallCount: 1 },
});

export const haulingProfit = defineCapability({
  id: 'logistics.hauling.profit',
  version: '1.0.0',
  name: 'Hauling Profit',
  description:
    'Calculate hauling profitability — compare buy and sell prices between regions minus freight cost to find profitable hauling routes',
  inputs: {
    buyPrice: { type: 'eve.currency.isk', description: 'Item buy price at origin' },
    sellPrice: { type: 'eve.currency.isk', description: 'Item sell price at destination' },
    shippingCost: { type: 'eve.currency.isk', description: 'Freight cost' },
  },
  outputs: {
    profit: { type: 'eve.currency.isk', description: 'Net hauling profit per unit' },
    margin: { type: 'eve.percentage', description: 'Profit margin after shipping' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});

export const cargoValue = defineCapability({
  id: 'logistics.cargo.value',
  version: '1.0.0',
  name: 'Cargo Value',
  description:
    'Calculate total ISK value of cargo — estimate the market value of a collection of items or orders for insurance and collateral',
  inputs: {
    orders: {
      type: 'eve.market.order.collection',
      description: 'Items to evaluate',
    },
  },
  outputs: {
    totalValue: { type: 'eve.currency.isk', description: 'Total estimated ISK value' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 5, esiCallCount: 0 },
});
