import { defineCapability } from '@eve-fabric/kit';
import { asOrders, buyOrders, round2, sellOrders, type EsiMarketOrder } from '../support.js';

const PURE = { estimatedLatencyMs: 1 } as const;

function volume(list: readonly EsiMarketOrder[]): number {
  return list.reduce((sum, o) => sum + (o.volume_remain ?? 0), 0);
}

export const marketSpread = defineCapability({
  id: 'market.spread',
  version: '2.0.0',
  name: 'Market Spread',
  description:
    'Calculate the bid-ask spread — the percentage gap between the lowest sell price and the highest buy price in a market',
  inputs: {
    orders: { type: 'eve.market.order.collection', description: 'Market orders to analyze' },
  },
  outputs: {
    spread: { type: 'eve.percentage', description: 'Spread as a percentage' },
    lowestSell: { type: 'eve.currency.isk', description: 'Lowest sell price' },
    highestBuy: { type: 'eve.currency.isk', description: 'Highest buy price' },
  },
  attach: { on: 'eve.market.order.collection', as: 'spread', subject: 'orders' },
  cost: PURE,
  run({ orders }) {
    const all = asOrders(orders);
    const sells = sellOrders(all);
    const buys = buyOrders(all);
    const lowestSell = sells.length > 0 ? Math.min(...sells.map((o) => o.price)) : 0;
    const highestBuy = buys.length > 0 ? Math.max(...buys.map((o) => o.price)) : 0;
    const spread = lowestSell > 0 ? ((lowestSell - highestBuy) / lowestSell) * 100 : 0;
    return { spread: round2(spread), lowestSell, highestBuy };
  },
});

export const marketVolumeTotal = defineCapability({
  id: 'market.volume.total',
  version: '2.0.0',
  name: 'Market Volume',
  description:
    'Calculate total trade volume — sum up all sell and buy order quantities to see how active a market is',
  inputs: {
    orders: { type: 'eve.market.order.collection', description: 'Market orders to sum' },
  },
  outputs: {
    totalVolume: { type: 'eve.quantity', description: 'Total volume across all orders' },
    sellVolume: { type: 'eve.quantity', description: 'Total sell order volume' },
    buyVolume: { type: 'eve.quantity', description: 'Total buy order volume' },
  },
  attach: { on: 'eve.market.order.collection', as: 'volume', subject: 'orders' },
  cost: PURE,
  run({ orders }) {
    const all = asOrders(orders);
    return {
      totalVolume: volume(all),
      sellVolume: volume(sellOrders(all)),
      buyVolume: volume(buyOrders(all)),
    };
  },
});

export const marketCheapest = defineCapability({
  id: 'market.cheapest',
  version: '2.0.0',
  name: 'Find Cheapest',
  description:
    'Find the cheapest sell order — the best deal and lowest price available in a collection of market orders',
  inputs: {
    orders: { type: 'eve.market.order.collection', description: 'Market orders to search' },
  },
  outputs: {
    cheapest: { type: 'eve.market.order', description: 'The cheapest sell order' },
    price: { type: 'eve.currency.isk', description: 'The lowest price found' },
  },
  attach: { on: 'eve.market.order.collection', as: 'cheapest', subject: 'orders' },
  cost: PURE,
  run({ orders }) {
    const sells = sellOrders(asOrders(orders));
    if (sells.length === 0) return { cheapest: null, price: null };
    const cheapest = sells.reduce((min, o) => (o.price < min.price ? o : min), sells[0]!);
    return { cheapest, price: cheapest.price };
  },
});

export const marketHighestBuyer = defineCapability({
  id: 'market.highest.buyer',
  version: '2.0.0',
  name: 'Find Highest Buyer',
  description:
    'Find the highest buy order — the most someone is willing to pay for an item in the market',
  inputs: {
    orders: { type: 'eve.market.order.collection', description: 'Market orders to search' },
  },
  outputs: {
    highest: { type: 'eve.market.order', description: 'The highest buy order' },
    price: { type: 'eve.currency.isk', description: 'The highest buy price' },
  },
  attach: { on: 'eve.market.order.collection', as: 'highestBuyer', subject: 'orders' },
  cost: PURE,
  run({ orders }) {
    const buys = buyOrders(asOrders(orders));
    if (buys.length === 0) return { highest: null, price: null };
    const highest = buys.reduce((max, o) => (o.price > max.price ? o : max), buys[0]!);
    return { highest, price: highest.price };
  },
});

export const marketOrderCount = defineCapability({
  id: 'market.order.count',
  version: '2.0.0',
  name: 'Order Count',
  description:
    'Count the number of active buy and sell orders — measure market depth and liquidity for an item',
  inputs: {
    orders: { type: 'eve.market.order.collection', description: 'Market orders to count' },
  },
  outputs: {
    totalOrders: { type: 'eve.quantity', description: 'Total number of orders' },
    sellOrders: { type: 'eve.quantity', description: 'Number of sell orders' },
    buyOrders: { type: 'eve.quantity', description: 'Number of buy orders' },
  },
  attach: { on: 'eve.market.order.collection', as: 'counts', subject: 'orders' },
  cost: PURE,
  run({ orders }) {
    const all = asOrders(orders);
    return {
      totalOrders: all.length,
      sellOrders: sellOrders(all).length,
      buyOrders: buyOrders(all).length,
    };
  },
});
