import { defineCapability } from '../define-capability.js';

export const marketSpread = defineCapability({
  id: 'market.spread',
  version: '1.0.0',
  name: 'Market Spread',
  description:
    'Calculate the bid-ask spread — the percentage gap between the lowest sell price and the highest buy price in a market',
  inputs: {
    orders: {
      type: 'eve.market.order.collection',
      description: 'Market orders to analyze',
    },
  },
  outputs: {
    spread: { type: 'eve.percentage', description: 'Spread as a percentage' },
    lowestSell: { type: 'eve.currency.isk', description: 'Lowest sell price' },
    highestBuy: { type: 'eve.currency.isk', description: 'Highest buy price' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 5, esiCallCount: 0 },
});

export const marketVolumeTotal = defineCapability({
  id: 'market.volume.total',
  version: '1.0.0',
  name: 'Market Volume',
  description:
    'Calculate total trade volume — sum up all sell and buy order quantities to see how active a market is',
  inputs: {
    orders: {
      type: 'eve.market.order.collection',
      description: 'Market orders to sum',
    },
  },
  outputs: {
    totalVolume: { type: 'eve.quantity', description: 'Total volume across all orders' },
    sellVolume: { type: 'eve.quantity', description: 'Total sell order volume' },
    buyVolume: { type: 'eve.quantity', description: 'Total buy order volume' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 5, esiCallCount: 0 },
});

export const marketCheapest = defineCapability({
  id: 'market.cheapest',
  version: '1.0.0',
  name: 'Find Cheapest',
  description:
    'Find the cheapest sell order — the best deal and lowest price available in a collection of market orders',
  inputs: {
    orders: {
      type: 'eve.market.order.collection',
      description: 'Market orders to search',
    },
  },
  outputs: {
    cheapest: { type: 'eve.market.order', description: 'The cheapest sell order' },
    price: { type: 'eve.currency.isk', description: 'The lowest price found' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});

export const marketHighestBuyer = defineCapability({
  id: 'market.highest.buyer',
  version: '1.0.0',
  name: 'Find Highest Buyer',
  description:
    'Find the highest buy order — the most someone is willing to pay for an item in the market',
  inputs: {
    orders: {
      type: 'eve.market.order.collection',
      description: 'Market orders to search',
    },
  },
  outputs: {
    highest: { type: 'eve.market.order', description: 'The highest buy order' },
    price: { type: 'eve.currency.isk', description: 'The highest buy price' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});

export const marketOrderCount = defineCapability({
  id: 'market.order.count',
  version: '1.0.0',
  name: 'Order Count',
  description:
    'Count the number of active buy and sell orders — measure market depth and liquidity for an item',
  inputs: {
    orders: {
      type: 'eve.market.order.collection',
      description: 'Market orders to count',
    },
  },
  outputs: {
    totalOrders: { type: 'eve.quantity', description: 'Total number of orders' },
    sellOrders: { type: 'eve.quantity', description: 'Number of sell orders' },
    buyOrders: { type: 'eve.quantity', description: 'Number of buy orders' },
  },
  source: 'DERIVED',
  auth: { required: false },
  cache: { cacheable: false },
  cost: { estimatedLatencyMs: 1, esiCallCount: 0 },
});
