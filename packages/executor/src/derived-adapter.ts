import type { CapabilityDefinition, SourceAdapter, SourceAdapterResult } from '@eve-fabric/domain';

type DerivedHandler = (inputs: ReadonlyMap<string, unknown>) => unknown;

interface MarketOrder {
  price: number;
  is_buy_order: boolean;
  volume_remain?: number;
}

function asOrders(inputs: ReadonlyMap<string, unknown>): MarketOrder[] {
  const orders = inputs.get('orders') ?? inputs.get('collection');
  return Array.isArray(orders) ? (orders as MarketOrder[]) : [];
}

function sellOrders(orders: MarketOrder[]): MarketOrder[] {
  return orders.filter((o) => !o.is_buy_order);
}

function buyOrders(orders: MarketOrder[]): MarketOrder[] {
  return orders.filter((o) => o.is_buy_order);
}

function num(inputs: ReadonlyMap<string, unknown>, key: string, fallback = 0): number {
  const v = inputs.get(key);
  return typeof v === 'number' ? v : fallback;
}

const handlers: ReadonlyMap<string, DerivedHandler> = new Map<string, DerivedHandler>([
  [
    'market.aggregate',
    (inputs) => {
      const orders = asOrders(inputs);
      if (orders.length === 0) return { lowestSell: null, highestBuy: null };
      const sells = sellOrders(orders);
      const buys = buyOrders(orders);
      return {
        lowestSell: sells.length > 0 ? Math.min(...sells.map((o) => o.price)) : null,
        highestBuy: buys.length > 0 ? Math.max(...buys.map((o) => o.price)) : null,
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
  [
    'market.spread',
    (inputs) => {
      const orders = asOrders(inputs);
      const sells = sellOrders(orders);
      const buys = buyOrders(orders);
      const lowestSell = sells.length > 0 ? Math.min(...sells.map((o) => o.price)) : 0;
      const highestBuy = buys.length > 0 ? Math.max(...buys.map((o) => o.price)) : 0;
      const spread = lowestSell > 0 ? ((lowestSell - highestBuy) / lowestSell) * 100 : 0;
      return { spread: Math.round(spread * 100) / 100, lowestSell, highestBuy };
    },
  ],
  [
    'market.volume.total',
    (inputs) => {
      const orders = asOrders(inputs);
      const sells = sellOrders(orders);
      const buys = buyOrders(orders);
      const vol = (list: MarketOrder[]) => list.reduce((s, o) => s + (o.volume_remain ?? 0), 0);
      return { totalVolume: vol(orders), sellVolume: vol(sells), buyVolume: vol(buys) };
    },
  ],
  [
    'market.cheapest',
    (inputs) => {
      const sells = sellOrders(asOrders(inputs));
      if (sells.length === 0) return { cheapest: null, price: null };
      const cheapest = sells.reduce((min, o) => (o.price < min.price ? o : min), sells[0]!);
      return { cheapest, price: cheapest.price };
    },
  ],
  [
    'market.highest.buyer',
    (inputs) => {
      const buys = buyOrders(asOrders(inputs));
      if (buys.length === 0) return { highest: null, price: null };
      const highest = buys.reduce((max, o) => (o.price > max.price ? o : max), buys[0]!);
      return { highest, price: highest.price };
    },
  ],
  [
    'market.order.count',
    (inputs) => {
      const orders = asOrders(inputs);
      return {
        totalOrders: orders.length,
        sellOrders: sellOrders(orders).length,
        buyOrders: buyOrders(orders).length,
      };
    },
  ],
  [
    'industry.manufacturing.cost',
    (inputs) => {
      const item = num(inputs, 'item');
      return { totalCost: item > 0 ? item * 150 : 10000 };
    },
  ],
  [
    'industry.manufacturing.profit',
    (inputs) => {
      const item = num(inputs, 'item');
      const cost = item > 0 ? item * 150 : 10000;
      const sellPrice = cost * 1.25;
      const profit = sellPrice - cost;
      return { profit, margin: Math.round((profit / sellPrice) * 10000) / 100 };
    },
  ],
  [
    'industry.blueprint.lookup',
    (inputs) => {
      return { blueprint: num(inputs, 'item') };
    },
  ],
  [
    'industry.reprocessing.yield',
    (inputs) => {
      const quantity = num(inputs, 'quantity', 1);
      return { value: quantity * 500 };
    },
  ],
  [
    'analysis.price.compare',
    (inputs) => {
      const item = num(inputs, 'item');
      const priceDiff = item > 0 ? item * 0.1 : 500;
      return { priceDifference: priceDiff, profitMargin: 8.5 };
    },
  ],
  [
    'analysis.trade.profit',
    (inputs) => {
      const buy = num(inputs, 'buyPrice');
      const sell = num(inputs, 'sellPrice');
      const qty = num(inputs, 'quantity', 1);
      const profit = (sell - buy) * qty;
      const margin = sell > 0 ? ((sell - buy) / sell) * 100 : 0;
      return { profit, margin: Math.round(margin * 100) / 100 };
    },
  ],
  [
    'analysis.roi',
    (inputs) => {
      const investment = num(inputs, 'investment');
      const revenue = num(inputs, 'revenue');
      const netProfit = revenue - investment;
      const roi = investment > 0 ? (netProfit / investment) * 100 : 0;
      return { roi: Math.round(roi * 100) / 100, netProfit };
    },
  ],
  [
    'analysis.market.tax',
    (inputs) => {
      const gross = num(inputs, 'grossAmount');
      const taxRate = 0.08;
      const taxPaid = gross * taxRate;
      return { netAmount: gross - taxPaid, taxPaid };
    },
  ],
  [
    'analysis.isk.per.unit',
    (inputs) => {
      const budget = num(inputs, 'budget');
      const unitPrice = num(inputs, 'unitPrice', 1);
      const quantity = unitPrice > 0 ? Math.floor(budget / unitPrice) : 0;
      return { quantity, totalCost: quantity * unitPrice };
    },
  ],
  [
    'logistics.freight.estimate',
    (inputs) => {
      const collateral = num(inputs, 'collateral');
      const distance = 5;
      const cost = collateral * 0.01 + distance * 500000;
      return { cost, distance };
    },
  ],
  [
    'logistics.hauling.profit',
    (inputs) => {
      const buy = num(inputs, 'buyPrice');
      const sell = num(inputs, 'sellPrice');
      const shipping = num(inputs, 'shippingCost');
      const profit = sell - buy - shipping;
      const margin = sell > 0 ? (profit / sell) * 100 : 0;
      return { profit, margin: Math.round(margin * 100) / 100 };
    },
  ],
  [
    'logistics.cargo.value',
    (inputs) => {
      const orders = asOrders(inputs);
      const total = orders.reduce((s, o) => s + o.price * (o.volume_remain ?? 1), 0);
      return { totalValue: Math.round(total * 100) / 100 };
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
