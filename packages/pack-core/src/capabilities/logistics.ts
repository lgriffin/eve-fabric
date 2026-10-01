import { defineCapability } from '@eve-fabric/kit';
import { asOrders, num, round2 } from '../support.js';

const PURE = { estimatedLatencyMs: 1 } as const;

/** A stated freight tariff: 1% of collateral plus a flat rate per jump. */
const COLLATERAL_RATE = 0.01;
const ISK_PER_JUMP = 500_000;

export const freightEstimate = defineCapability({
  id: 'logistics.freight.estimate',
  version: '2.0.0',
  name: 'Freight Estimate',
  description:
    'Estimate a freight quote from jump distance and collateral — 1% of collateral plus 500k ISK per jump',
  inputs: {
    distance: { type: 'eve.route.distance', description: 'Route jump count' },
    collateral: { type: 'eve.currency.isk', description: 'Cargo value for collateral' },
  },
  outputs: {
    cost: { type: 'eve.currency.isk', description: 'Estimated shipping cost' },
  },
  cost: PURE,
  run({ distance, collateral }) {
    return { cost: num(collateral) * COLLATERAL_RATE + num(distance) * ISK_PER_JUMP };
  },
});

export const haulingProfit = defineCapability({
  id: 'logistics.hauling.profit',
  version: '2.0.0',
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
  cost: PURE,
  run({ buyPrice, sellPrice, shippingCost }) {
    const sell = num(sellPrice);
    const profit = sell - num(buyPrice) - num(shippingCost);
    const margin = sell > 0 ? (profit / sell) * 100 : 0;
    return { profit, margin: round2(margin) };
  },
});

export const cargoValue = defineCapability({
  id: 'logistics.cargo.value',
  version: '2.0.0',
  name: 'Cargo Value',
  description:
    'Calculate total ISK value of cargo — the market value of a collection of orders for insurance and collateral',
  inputs: {
    orders: { type: 'eve.market.order.collection', description: 'Items to evaluate' },
  },
  outputs: {
    totalValue: { type: 'eve.currency.isk', description: 'Total estimated ISK value' },
  },
  cost: PURE,
  run({ orders }) {
    const total = asOrders(orders).reduce((s, o) => s + o.price * (o.volume_remain ?? 1), 0);
    return { totalValue: round2(total) };
  },
});
