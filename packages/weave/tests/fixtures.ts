import type { PipelineDefinition } from '@eve-fabric/core';
import type { WeaveBody } from '../src/index.js';

export const pipeline = {
  id: 'someone-spread',
  version: 1,
  name: 'Spread',
  inputs: [{ name: 'item', semanticType: 'eve.type.reference', required: true }],
  nodes: [{ id: 'orders', capability: { id: 'market.orders', version: '2.0.0' } }],
  edges: [{ from: 'input.item', to: 'orders.item' }],
  outputs: [{ name: 'orders', source: 'orders.orders' }],
} as unknown as PipelineDefinition;

export const body: WeaveBody = {
  format: 2,
  id: 'someone.spread',
  version: '1.0.0',
  name: 'Spread',
  description: 'The orders for an item',
  provides: {
    attach: { on: 'eve.type', as: 'spread', subject: 'item' },
    in: { item: 'eve.type.reference' },
    out: { orders: 'eve.market.order.collection' },
  },
  requires: { 'market.orders': '^2.0.0' },
  scopes: [],
  verifiedAgainst: { esiCompatibilityDate: '2026-08-18', sdeBuild: 'test' },
  pipeline,
};
