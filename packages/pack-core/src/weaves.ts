import type { PipelineDefinition, SemanticTypeId } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';
import type { Weave } from '@eve-fabric/kit';

function node(id: string, capability: string): PipelineDefinition['nodes'][number] {
  return { id, capability: { id: capabilityId(capability), version: capabilityVersion('2.0.0') } };
}

function input(name: string, type: string, description: string) {
  return { name, semanticType: type as SemanticTypeId, required: true, description };
}

/**
 * Buy in one region, sell in another: two order lookups from one item that
 * run side by side, joined by the profit per unit after sales tax.
 */
const tradeProfitAfterTax: PipelineDefinition = {
  id: 'pack-core.trade-profit-after-tax',
  version: 1,
  name: 'Trade profit after tax',
  description: "Profit per unit buying at one region's lowest sell and selling at another's",
  inputs: [
    input('item', 'eve.type.reference', 'The item to trade'),
    input('from', 'eve.region.reference', 'Region to buy in'),
    input('to', 'eve.region.reference', 'Region to sell in'),
  ],
  nodes: [
    node('buy', 'market.orders'),
    node('sell', 'market.orders'),
    node('buyPrices', 'market.aggregate'),
    node('sellPrices', 'market.aggregate'),
    node('tax', 'analysis.market.tax'),
    node('profit', 'analysis.unit.profit'),
  ],
  edges: [
    { from: 'input.item', to: 'buy.item' },
    { from: 'input.from', to: 'buy.region' },
    { from: 'input.item', to: 'sell.item' },
    { from: 'input.to', to: 'sell.region' },
    { from: 'buy.orders', to: 'buyPrices.orders' },
    { from: 'sell.orders', to: 'sellPrices.orders' },
    { from: 'sellPrices.lowestSell', to: 'tax.grossAmount' },
    { from: 'buyPrices.lowestSell', to: 'profit.cost' },
    { from: 'tax.netAmount', to: 'profit.revenue' },
  ],
  outputs: [{ name: 'profit', source: 'profit.profit' }],
};

/**
 * Which of my sell orders have been undercut: the best rival price for each
 * order, looked up once per order in that order's region (my own orders are
 * never rivals), then compared.
 */
const myUndercutOrders: PipelineDefinition = {
  id: 'pack-core.undercut-orders',
  version: 1,
  name: 'Undercut orders',
  description: 'The sell orders a rival undercuts in their own region',
  inputs: [input('orders', 'eve.character.order.collection', 'Your open orders')],
  nodes: [
    { ...node('rival', 'market.order.rival'), each: { port: 'order' } },
    node('undercut', 'market.orders.undercut'),
  ],
  edges: [
    { from: 'input.orders', to: 'rival.order' },
    { from: 'input.orders', to: 'rival.mine' },
    { from: 'input.orders', to: 'undercut.orders' },
    { from: 'rival.best', to: 'undercut.rivals' },
  ],
  outputs: [{ name: 'undercut', source: 'undercut.undercut' }],
};

/** Joins the core pack publishes as capabilities when it is installed. */
export const coreWeaves: readonly Weave[] = [
  {
    pipeline: tradeProfitAfterTax,
    capability: {
      id: 'trade.profit.after.tax',
      version: '1.0.0',
      name: 'Trade Profit After Tax',
      description:
        "Profit per unit buying at one region's lowest sell price and selling at another's, after sales tax",
      attach: { on: 'eve.type', as: 'trade profit after tax', subject: 'item' },
    },
  },
  {
    pipeline: myUndercutOrders,
    capability: {
      id: 'market.my.undercut',
      version: '1.0.0',
      name: 'Undercut Orders',
      description:
        'Which of your sell orders a rival undercuts: each order checked against its own region market',
      attach: { on: 'eve.character.order.collection', as: 'undercut', subject: 'orders' },
    },
  },
];
