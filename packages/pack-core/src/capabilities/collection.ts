import { defineCapability } from '@eve-fabric/kit';

const PURE = { estimatedLatencyMs: 1 } as const;
const DEFAULT_LIMIT = 10;

function priceOf(item: unknown): number {
  return typeof item === 'object' && item !== null && 'price' in item ? Number(item.price) : 0;
}

export const filter = defineCapability({
  id: 'collection.filter',
  version: '2.0.0',
  name: 'Filter Collection',
  description: 'Filter market orders — keep only the orders priced at or below a threshold',
  inputs: {
    collection: { type: 'eve.market.order.collection', description: 'Collection to filter' },
    threshold: {
      type: 'eve.currency.isk',
      description: 'Maximum price to keep',
      required: false,
    },
  },
  outputs: {
    result: { type: 'eve.market.order.collection', description: 'Filtered collection' },
  },
  cost: PURE,
  run({ collection, threshold }) {
    if (!Array.isArray(collection)) return { result: [] };
    if (typeof threshold !== 'number') return { result: collection };
    return { result: collection.filter((item) => priceOf(item) <= threshold) };
  },
});

export const sort = defineCapability({
  id: 'collection.sort',
  version: '2.0.0',
  name: 'Sort Collection',
  description: 'Sort market orders by price, cheapest first — rank results for analysis',
  inputs: {
    collection: { type: 'eve.market.order.collection', description: 'Collection to sort' },
  },
  outputs: {
    result: { type: 'eve.market.order.collection', description: 'Sorted collection' },
  },
  cost: PURE,
  run({ collection }) {
    if (!Array.isArray(collection)) return { result: [] };
    return { result: [...(collection as unknown[])].sort((a, b) => priceOf(a) - priceOf(b)) };
  },
});

export const limit = defineCapability({
  id: 'collection.limit',
  version: '2.0.0',
  name: 'Limit Collection',
  description:
    'Limit results to a specific count — take the top N cheapest, most expensive, or highest volume orders',
  inputs: {
    collection: { type: 'eve.market.order.collection', description: 'Collection to limit' },
    count: { type: 'eve.quantity', description: 'How many to keep (default 10)', required: false },
  },
  outputs: {
    result: { type: 'eve.market.order.collection', description: 'Limited collection' },
  },
  cost: PURE,
  run({ collection, count }) {
    if (!Array.isArray(collection)) return { result: [] };
    const n = typeof count === 'number' && count >= 0 ? count : DEFAULT_LIMIT;
    return { result: collection.slice(0, n) };
  },
});
