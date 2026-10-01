import { describe, it, expect } from 'vitest';
import {
  CapabilityCatalog,
  SemanticTypeRegistry,
  fixedClock,
  type CapabilityDefinition,
} from '@eve-fabric/domain';
import {
  ORDERS,
  REGION,
  STATION,
  SYSTEM,
  TYPE,
  tranquilityEsi,
  tranquilitySde,
} from '@eve-fabric/test-support';
import * as core from '../src/index.js';

const sde = tranquilitySde();
const { esi } = tranquilityEsi();
const context = { clock: fixedClock(0), esi: esi.public, sde };

async function run(
  capability: CapabilityDefinition,
  inputs: Record<string, unknown>,
): Promise<Readonly<Record<string, unknown>>> {
  return capability.run!(inputs, context);
}

const forgeTritanium = ORDERS[REGION.theForge]![TYPE.tritanium]!;

describe('the core pack', () => {
  it('lists every capability with a run, and registers in an executable catalog', () => {
    const types = new SemanticTypeRegistry();
    for (const type of core.corePack.types ?? []) types.register(type);
    const catalog = new CapabilityCatalog({ executable: true, types });
    for (const capability of core.corePack.capabilities) catalog.register(capability);
    expect(catalog.list()).toHaveLength(core.allCapabilities.length);
    for (const capability of core.allCapabilities) {
      expect(capability.outputs.size).toBeGreaterThan(0);
      expect(capability.run).toBeTypeOf('function');
    }
  });

  it('infers each capability source from what it uses', () => {
    expect(core.orders.source).toBe('ESI');
    expect(core.distance.source).toBe('ESI');
    expect(core.resolveType.source).toBe('SDE');
    expect(core.blueprintLookup.source).toBe('SDE');
    expect(core.aggregate.source).toBe('DERIVED');
  });
});

describe('universe resolvers', () => {
  it('resolve a type by name or id to its id', async () => {
    expect(await run(core.resolveType, { query: 'Tritanium' })).toEqual({ type: TYPE.tritanium });
    expect(await run(core.resolveType, { query: TYPE.rifter })).toEqual({ type: TYPE.rifter });
    await expect(run(core.resolveType, { query: 999 })).rejects.toThrow('not found');
    await expect(run(core.resolveType, { query: 'Nothing Such' })).rejects.toThrow('No type');
    await expect(run(core.resolveType, { query: true })).rejects.toThrow('numeric ID or string');
  });

  it('resolve a region by name, ignoring case, or id', async () => {
    expect(await run(core.resolveRegion, { query: 'the forge' })).toEqual({
      region: REGION.theForge,
    });
    expect(await run(core.resolveRegion, { query: REGION.domain })).toEqual({
      region: REGION.domain,
    });
    await expect(run(core.resolveRegion, { query: 1 })).rejects.toThrow('not found');
    await expect(run(core.resolveRegion, { query: 'Nowhere' })).rejects.toThrow('No region');
    await expect(run(core.resolveRegion, { query: null })).rejects.toThrow('numeric ID or string');
  });

  it('resolve a solar system by name or id', async () => {
    expect(await run(core.resolveSolarSystem, { query: 'Jita' })).toEqual({ system: SYSTEM.jita });
    expect(await run(core.resolveSolarSystem, { query: SYSTEM.amarr })).toEqual({
      system: SYSTEM.amarr,
    });
    await expect(run(core.resolveSolarSystem, { query: 30999999 })).rejects.toThrow('not found');
    await expect(run(core.resolveSolarSystem, { query: 'Nowhere' })).rejects.toThrow(
      'No solar system',
    );
    await expect(run(core.resolveSolarSystem, { query: [] })).rejects.toThrow(
      'numeric ID or string',
    );
  });

  it('resolve a station or a system to the system it is in', async () => {
    expect(await run(core.resolveLocation, { location: STATION.jita44 })).toEqual({
      system: SYSTEM.jita,
    });
    expect(await run(core.resolveLocation, { location: SYSTEM.perimeter })).toEqual({
      system: SYSTEM.perimeter,
    });
    await expect(run(core.resolveLocation, { location: 1_035_466_617_946 })).rejects.toThrow(
      'structures need an identity',
    );
    await expect(run(core.resolveLocation, { location: 'Jita' })).rejects.toThrow(
      'positive integer id',
    );
  });
});

describe('market', () => {
  it('fetches one item in one region, filtered by ESI', async () => {
    const { orders } = await run(core.orders, {
      region: REGION.theForge,
      item: TYPE.tritanium,
    });
    expect((orders as { order_id: number }[]).map((o) => o.order_id)).toEqual(
      forgeTritanium.map((o) => o.id),
    );
  });

  it('accepts ids as decimal strings and rejects anything else', async () => {
    const { orders } = await run(core.orders, { region: '10000002', item: '35' });
    expect(orders).toHaveLength(2);
    await expect(run(core.orders, { region: 'The Forge', item: 34 })).rejects.toThrow(
      'Input "region" must be a positive integer id',
    );
    // A decimal string is held to the same rule as a number.
    await expect(run(core.orders, { region: '0', item: 34 })).rejects.toThrow(
      'Input "region" must be a positive integer id, got "0"',
    );
    await expect(run(core.orders, { region: '9007199254740993', item: 34 })).rejects.toThrow(
      'must be a positive integer id',
    );
  });

  it('aggregates the lowest sell and highest buy', async () => {
    const { orders } = await run(core.orders, { region: REGION.theForge, item: TYPE.tritanium });
    expect(await run(core.aggregate, { orders })).toEqual({ lowestSell: 3.98, highestBuy: 3.71 });
    expect(await run(core.aggregate, { orders: [] })).toEqual({
      lowestSell: null,
      highestBuy: null,
    });
  });

  it('computes spread, volume, cheapest, highest buyer and counts', async () => {
    const { orders } = await run(core.orders, { region: REGION.theForge, item: TYPE.tritanium });
    const spread = await run(core.marketSpread, { orders });
    expect(spread).toMatchObject({ lowestSell: 3.98, highestBuy: 3.71 });
    expect(spread['spread']).toBeCloseTo(6.78, 2);

    const volume = await run(core.marketVolumeTotal, { orders });
    expect(volume['totalVolume']).toBe(
      (volume['sellVolume'] as number) + (volume['buyVolume'] as number),
    );

    expect(await run(core.marketCheapest, { orders })).toMatchObject({ price: 3.98 });
    expect(await run(core.marketHighestBuyer, { orders })).toMatchObject({ price: 3.71 });
    expect(await run(core.marketOrderCount, { orders })).toEqual({
      totalOrders: 3,
      sellOrders: 2,
      buyOrders: 1,
    });
  });

  it('handles markets with no orders', async () => {
    expect(await run(core.marketSpread, { orders: undefined })).toEqual({
      spread: 0,
      lowestSell: 0,
      highestBuy: 0,
    });
    expect(await run(core.marketCheapest, { orders: [] })).toEqual({ cheapest: null, price: null });
    expect(await run(core.marketHighestBuyer, { orders: [] })).toEqual({
      highest: null,
      price: null,
    });
  });
});

describe('routing', () => {
  it('counts jumps on the route ESI returns', async () => {
    expect(await run(core.distance, { origin: SYSTEM.jita, destination: SYSTEM.amarr })).toEqual({
      distance: 4,
    });
  });
});

describe('collections', () => {
  const items = [{ price: 3 }, { price: 1 }, { price: 2 }];

  it('filters at or below a threshold, or keeps all without one', async () => {
    expect(await run(core.filter, { collection: items, threshold: 2 })).toEqual({
      result: [{ price: 1 }, { price: 2 }],
    });
    expect(await run(core.filter, { collection: items })).toEqual({ result: items });
    expect(await run(core.filter, { collection: 'x' })).toEqual({ result: [] });
  });

  it('sorts by price ascending', async () => {
    expect(await run(core.sort, { collection: items })).toEqual({
      result: [{ price: 1 }, { price: 2 }, { price: 3 }],
    });
    expect(await run(core.sort, { collection: null })).toEqual({ result: [] });
  });

  it('limits to a count, ten by default', async () => {
    expect(await run(core.limit, { collection: items, count: 1 })).toEqual({
      result: [{ price: 3 }],
    });
    const many = Array.from({ length: 12 }, (_, i) => ({ price: i }));
    expect((await run(core.limit, { collection: many }))['result']).toHaveLength(10);
    expect(await run(core.limit, { collection: {} })).toEqual({ result: [] });
  });
});

describe('industry', () => {
  it('finds the blueprint that manufactures an item', async () => {
    expect(await run(core.blueprintLookup, { item: TYPE.rifter })).toEqual({
      blueprint: TYPE.rifterBlueprint,
    });
    await expect(run(core.blueprintLookup, { item: TYPE.tritanium })).rejects.toThrow(
      'No blueprint',
    );
  });
});

describe('analysis', () => {
  it('computes trade profit and margin', async () => {
    expect(await run(core.tradeProfit, { buyPrice: 80, sellPrice: 100, quantity: 10 })).toEqual({
      profit: 200,
      margin: 20,
    });
    expect(await run(core.tradeProfit, { buyPrice: 1, sellPrice: 0 })).toEqual({
      profit: -1,
      margin: 0,
    });
  });

  it('computes return on investment', async () => {
    expect(await run(core.returnOnInvestment, { investment: 100, revenue: 150 })).toEqual({
      roi: 50,
      netProfit: 50,
    });
    expect(await run(core.returnOnInvestment, { investment: 0, revenue: 10 })).toEqual({
      roi: 0,
      netProfit: 10,
    });
  });

  it('deducts the stated 8% tax and broker fee', async () => {
    expect(await run(core.marketTax, { grossAmount: 1000 })).toEqual({
      netAmount: 920,
      taxPaid: 80,
    });
  });

  it('converts a budget to a quantity at a unit price', async () => {
    expect(await run(core.iskPerUnit, { budget: 1000, unitPrice: 300 })).toEqual({
      quantity: 3,
      totalCost: 900,
    });
    expect(await run(core.iskPerUnit, { budget: 1000, unitPrice: 0 })).toEqual({
      quantity: 0,
      totalCost: 0,
    });
  });
});

describe('logistics', () => {
  it('quotes freight at 1% of collateral plus 500k per jump', async () => {
    expect(await run(core.freightEstimate, { distance: 4, collateral: 100_000_000 })).toEqual({
      cost: 3_000_000,
    });
  });

  it('computes hauling profit after freight', async () => {
    expect(
      await run(core.haulingProfit, { buyPrice: 80, sellPrice: 100, shippingCost: 5 }),
    ).toEqual({ profit: 15, margin: 15 });
    expect(await run(core.haulingProfit, { buyPrice: 1, sellPrice: 0, shippingCost: 0 })).toEqual({
      profit: -1,
      margin: 0,
    });
  });

  it('values cargo at price times remaining volume', async () => {
    expect(
      await run(core.cargoValue, {
        orders: [
          { price: 2, volume_remain: 10 },
          { price: 1.5, volume_remain: 3 },
        ],
      }),
    ).toEqual({ totalValue: 24.5 });
  });
});

describe('resolvers: each reference type to its record', () => {
  it('follows a type, region and system to their SDE records', async () => {
    expect(await run(core.typeRecord, { id: TYPE.tritanium })).toEqual({
      type: {
        type_id: TYPE.tritanium,
        name: 'Tritanium',
        group_id: 18,
        volume: 0.01,
        market_group_id: 1857,
      },
    });
    expect(await run(core.regionRecord, { id: REGION.theForge })).toEqual({
      region: { region_id: REGION.theForge, name: 'The Forge' },
    });
    expect(await run(core.systemRecord, { id: SYSTEM.jita })).toEqual({
      system: {
        system_id: SYSTEM.jita,
        name: 'Jita',
        security_status: 0.9459,
        region_id: REGION.theForge,
      },
    });
    await expect(run(core.typeRecord, { id: 1 })).rejects.toThrow('not found');
    await expect(run(core.regionRecord, { id: 1 })).rejects.toThrow('not found');
    await expect(run(core.systemRecord, { id: 1 })).rejects.toThrow('not found');
  });

  it('follows a location to a station or system, and a structure to a typed unknown', async () => {
    expect(await run(core.locationRecord, { id: STATION.amarrEmperor })).toEqual({
      location: { location_id: STATION.amarrEmperor, kind: 'station', system_id: SYSTEM.amarr },
    });
    expect(await run(core.locationRecord, { id: SYSTEM.urlen })).toEqual({
      location: { location_id: SYSTEM.urlen, kind: 'system', system_id: SYSTEM.urlen },
    });
    expect(await run(core.locationRecord, { id: 1_035_466_617_946 })).toEqual({
      location: { location_id: 1_035_466_617_946, kind: 'structure' },
    });
    // An id in system range the SDE does not know is not a system.
    expect(await run(core.locationRecord, { id: 30_999_999 })).toEqual({
      location: { location_id: 30_999_999, kind: 'structure' },
    });
  });
});

describe('the eve.* types', () => {
  const types = new SemanticTypeRegistry();
  for (const type of core.coreTypes) types.register(type);

  it('reads ESI market orders as eve.market.order values, unchanged', async () => {
    const { orders } = await run(core.orders, { region: REGION.theForge, item: TYPE.tritanium });
    expect(types.check('eve.market.order.collection', orders)).toEqual({ ok: true });
    expect(types.check('eve.market.order', { ...(orders as object[])[0], price: '4.12' }).ok).toBe(
      false,
    );
  });

  it('types every resolver output as the record its reference names', async () => {
    for (const reference of core.coreTypes.filter((t) => t.kind === 'reference')) {
      const resolver = core.allCapabilities.find((c) => c.id === reference.resolver?.capability);
      expect(resolver?.inputs.get(reference.resolver!.input)?.semanticType).toBe(reference.id);
      expect(resolver?.outputs.get(reference.resolver!.output)?.semanticType).toBe(
        reference.entity,
      );
    }
    const { system } = await run(core.systemRecord, { id: SYSTEM.sivala });
    expect(types.check('eve.system', system)).toEqual({ ok: true });
  });

  it('lets an order be followed: its location, type and system are references', () => {
    expect(
      types
        .referencesIn('eve.market.order')
        .map((t) => t.id)
        .sort(),
    ).toEqual(['eve.location.reference', 'eve.system.reference', 'eve.type.reference']);
  });

  it('allows a margin below zero and a return above 100%', () => {
    expect(types.check('eve.percentage', -25).ok).toBe(true);
    expect(types.check('eve.percentage', 250).ok).toBe(true);
    expect(types.check('eve.percentage', Number.NaN).ok).toBe(false);
  });
});
