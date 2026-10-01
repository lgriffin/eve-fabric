import { defineCapability } from '@eve-fabric/kit';
import { buyOrders, collect, requireId, sellOrders, asOrders } from '../support.js';
import { EveCharacterOrder, EveCharacterOrders, EveCurrencyIsk, EveIskAmounts } from '../types.js';

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
  attach: { on: 'eve.type', as: 'orders', subject: 'item' },
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
  attach: { on: 'eve.market.order.collection', as: 'prices', subject: 'orders' },
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

interface OwnOrder {
  readonly order_id: number;
  readonly type_id: number;
  readonly region_id: number;
  readonly location_id: number;
  readonly price: number;
  readonly is_buy_order?: boolean;
}

export const bestRival = defineCapability({
  id: 'market.order.rival',
  version: '2.0.0',
  name: 'Best Rival Price',
  description:
    "The best price another trader offers against one of your orders: the lowest other sell, or the highest other buy, in the order's region",
  inputs: { order: { type: EveCharacterOrder, description: 'Your order' } },
  outputs: { best: { type: EveCurrencyIsk, description: 'The best rival price, if any' } },
  uses: ['esi.public', 'sde'],
  cost: { estimatedLatencyMs: 500 },
  async run({ order }, { esi, sde }) {
    const own = order as OwnOrder;
    // The region the order trades in, from where it sits: a station's
    // system's region in the SDE, else the region ESI reported.
    const station = sde.getNpcStation(own.location_id);
    const system = station === null ? null : sde.getSolarSystem(station.solarSystemId);
    const region = system?.regionId ?? requireId(own.region_id, 'order.region_id');
    const buying = own.is_buy_order === true;
    const market = await collect(
      esi.market(region).orders.get({ order_type: buying ? 'buy' : 'sell', type_id: own.type_id }),
    );
    const prices = market
      .filter((o) => o.is_buy_order === buying && o.order_id !== own.order_id)
      .map((o) => o.price);
    if (prices.length === 0) return { best: null };
    return { best: buying ? Math.max(...prices) : Math.min(...prices) };
  },
});

export const undercutOrders = defineCapability({
  id: 'market.orders.undercut',
  version: '2.0.0',
  name: 'Undercut Orders',
  description:
    'The orders a rival beats: a cheaper sell, or a higher buy, than yours. Rival prices line up with the orders',
  inputs: {
    orders: { type: EveCharacterOrders, description: 'Your orders' },
    rivals: { type: EveIskAmounts, description: 'The best rival price for each order' },
  },
  outputs: { undercut: { type: EveCharacterOrders, description: 'The orders that are beaten' } },
  run({ orders: value, rivals }) {
    const own = value as readonly OwnOrder[];
    const best = rivals as readonly (number | null | undefined)[];
    const undercut = own.filter((order, i) => {
      const rival = best[i];
      if (typeof rival !== 'number') return false;
      return order.is_buy_order === true ? rival > order.price : rival < order.price;
    });
    return { undercut };
  },
});
