import type {
  CatalogCapability,
  DraftRequest,
  DraftView,
} from '../../src/services/draft-client.js';

/**
 * A fabric that answers three drafts about Tritanium: fresh, with orders
 * attached (a region still needed), and complete. The real fabric is
 * exercised in the draft store's tests; here only the panel is.
 */
const pipeline = (nodes: string[]): DraftView['pipeline'] => ({
  id: 'draft',
  version: 1,
  name: 'Question',
  inputs: [],
  outputs: [],
  nodes: nodes.map((id) => ({ id, capability: { id: `x.${id}` as never } })),
  edges: nodes.length > 1 ? [{ from: 'type.type', to: 'orders.item' }] : [],
});

const ordersMove = {
  name: 'orders',
  kind: 'attach' as const,
  capability: 'market.orders@1.0.0',
  description: 'Orders for the type in a region',
  yields: 'eve.market.orders' as never,
};

export const fresh: DraftView = {
  subject: { kind: 'type', value: 'Tritanium' },
  steps: [],
  cursor: { ref: 'type', type: 'eve.type' },
  complete: true,
  moves: [
    ordersMove,
    {
      ...ordersMove,
      name: 'wallet journal',
      description: 'Private',
      unavailable: { scopes: ['esi-wallet.read_character_wallet.v1'] },
    },
  ],
  holes: [],
  pipeline: pipeline(['type']),
  values: {},
  graphql: '{ type(name: "Tritanium") { name } }',
  plan: { steps: [], esiCalls: 0, maxEsiCalls: 0, scopes: [] },
};

export const withOrders: DraftView = {
  ...fresh,
  steps: [{ kind: 'move', move: 'orders', added: ['orders'], cursor: 'orders.orders' }],
  cursor: { ref: 'orders.orders', type: 'eve.market.orders' },
  complete: false,
  moves: [],
  holes: [{ name: 'region', node: 'orders', port: 'region', type: 'eve.region.reference' }],
  pipeline: pipeline(['type', 'orders']),
  graphql: undefined,
  plan: undefined,
};

export const complete: DraftView = {
  ...withOrders,
  steps: [...withOrders.steps, { kind: 'fill', hole: 'orders.region', value: 10000002 }],
  complete: true,
  holes: [],
  values: { 'orders.region': 10000002 },
  graphql: '{ type(name: "Tritanium") { orders(region: "The Forge") { price } } }',
  plan: {
    steps: [
      { id: 'type', capability: 'universe.type@1.0.0', source: 'SDE', waitsFor: [] },
      { id: 'orders', capability: 'market.orders@1.0.0', source: 'ESI', waitsFor: ['type'] },
    ],
    esiCalls: 1,
    maxEsiCalls: 1,
    scopes: [],
  },
};

/** The view a request earns: by how many changes it carries. */
export function answer(request: DraftRequest): DraftView {
  if ('graphql' in request) return complete;
  const steps = request.steps ?? [];
  if (steps.length === 0) return fresh;
  if (steps.length === 1) return withOrders;
  return complete;
}

/** The two capabilities the fixture's scaffolds are made of, as the catalog describes them. */
export const catalog: CatalogCapability[] = [
  {
    id: 'x.type',
    version: '1.0.0',
    name: 'Type',
    description: '',
    source: 'SDE',
    inputs: [],
    outputs: [{ name: 'type', semanticType: 'eve.type.reference' }],
    isComposite: false,
  },
  {
    id: 'x.orders',
    version: '1.0.0',
    name: 'Orders',
    description: '',
    source: 'ESI',
    inputs: [
      { name: 'item', semanticType: 'eve.type.reference', required: true },
      { name: 'region', semanticType: 'eve.region.reference', required: true },
    ],
    outputs: [{ name: 'orders', semanticType: 'eve.market.orders' }],
    isComposite: false,
  },
];
