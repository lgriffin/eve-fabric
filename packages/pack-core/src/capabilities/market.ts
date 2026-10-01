import { defineCapability } from '@eve-fabric/kit';
import { buyOrders, collect, requireId, sellOrders, asOrders } from '../support.js';

export const orders = defineCapability({
  id: 'market.orders',
  version: '2.0.0',
  name: 'Market Orders',
  description:
    'Fetch live market orders for an item in a region — get current buy and sell prices, volumes, and order details',
  inputs: {
    region: { type: 'eve.region.reference', description: 'Target region' },
    item: { type: 'eve.type.reference', description: 'Item type to look up' },
  },
  outputs: {
    orders: { type: 'eve.market.order.collection', description: 'List of market orders' },
  },
  uses: ['esi.public'],
  dependencies: ['universe.resolve.region', 'universe.resolve.type'],
  cost: { estimatedLatencyMs: 500 },
  async run({ region, item }, { esi }) {
    // ESI filters by type server side; a single-item lookup never pages the
    // whole region.
    const found = await collect(
      esi.market(requireId(region, 'region')).orders.get({
        order_type: 'all',
        type_id: requireId(item, 'item'),
      }),
    );
    return { orders: found };
  },
});

export const aggregate = defineCapability({
  id: 'market.aggregate',
  version: '2.0.0',
  name: 'Aggregate Market Data',
  description:
    'Calculate market price statistics — find the lowest sell price, highest buy price, and price spread from market orders',
  inputs: {
    orders: { type: 'eve.market.order.collection', description: 'Orders to aggregate' },
  },
  outputs: {
    lowestSell: { type: 'eve.currency.isk', description: 'Lowest sell price' },
    highestBuy: { type: 'eve.currency.isk', description: 'Highest buy price' },
  },
  cost: { estimatedLatencyMs: 5 },
  run({ orders: value }) {
    const all = asOrders(value);
    const sells = sellOrders(all);
    const buys = buyOrders(all);
    return {
      lowestSell: sells.length > 0 ? Math.min(...sells.map((o) => o.price)) : null,
      highestBuy: buys.length > 0 ? Math.max(...buys.map((o) => o.price)) : null,
    };
  },
});
