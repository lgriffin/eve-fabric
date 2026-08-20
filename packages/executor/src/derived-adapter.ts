import type { CapabilityDefinition, SourceAdapter, SourceAdapterResult } from '@eve-fabric/domain';

type DerivedHandler = (inputs: ReadonlyMap<string, unknown>) => unknown;

const handlers: ReadonlyMap<string, DerivedHandler> = new Map<string, DerivedHandler>([
  [
    'market.aggregate',
    (inputs) => {
      const orders = inputs.get('orders') as
        Array<{ price: number; is_buy_order: boolean }> | undefined;
      if (!Array.isArray(orders) || orders.length === 0) {
        return { lowestSell: null, highestBuy: null };
      }
      const sellOrders = orders.filter((o) => !o.is_buy_order);
      const buyOrders = orders.filter((o) => o.is_buy_order);
      return {
        lowestSell: sellOrders.length > 0 ? Math.min(...sellOrders.map((o) => o.price)) : null,
        highestBuy: buyOrders.length > 0 ? Math.max(...buyOrders.map((o) => o.price)) : null,
      };
    },
  ],
  [
    'collection.filter',
    (inputs) => {
      const collection = inputs.get('collection') as unknown[] | undefined;
      const threshold = inputs.get('threshold') as number | undefined;
      if (!Array.isArray(collection)) return [];
      if (threshold === undefined) return collection;
      return collection.filter(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          'price' in item &&
          (item as { price: number }).price <= threshold,
      );
    },
  ],
  [
    'collection.sort',
    (inputs) => {
      const collection = inputs.get('collection') as unknown[] | undefined;
      if (!Array.isArray(collection)) return [];
      return [...collection].sort((a, b) => {
        const aVal =
          typeof a === 'object' && a !== null && 'price' in a ? (a as { price: number }).price : 0;
        const bVal =
          typeof b === 'object' && b !== null && 'price' in b ? (b as { price: number }).price : 0;
        return aVal - bVal;
      });
    },
  ],
  [
    'collection.limit',
    (inputs) => {
      const collection = inputs.get('collection') as unknown[] | undefined;
      if (!Array.isArray(collection)) return [];
      const limit = (inputs.get('limit') as number | undefined) ?? 10;
      return collection.slice(0, limit);
    },
  ],
]);

export class DerivedAdapter implements SourceAdapter {
  readonly name = 'DERIVED';

  supports(capability: CapabilityDefinition): boolean {
    return capability.source === 'DERIVED' || capability.source === 'COMPOSITE';
  }

  async execute(
    capability: CapabilityDefinition,
    inputs: ReadonlyMap<string, unknown>,
  ): Promise<SourceAdapterResult> {
    const handler = handlers.get(capability.id);
    if (handler === undefined) {
      throw new Error(`Derived adapter does not handle capability "${capability.id}"`);
    }

    const data = handler(inputs);

    return {
      data,
      provenance: {
        source: 'DERIVED',
        capability: { id: capability.id, version: capability.version },
        capabilityVersion: capability.version,
        calculatedAt: new Date(),
        cached: false,
        upstream: [],
      },
    };
  }
}
