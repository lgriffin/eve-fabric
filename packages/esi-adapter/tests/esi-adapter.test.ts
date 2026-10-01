import { describe, it, expect, vi } from 'vitest';
import { EsiAdapter } from '../src/esi-adapter.js';
import type { CapabilityDefinition } from '@eve-fabric/domain';

function makeCapability(id: string, source: string): CapabilityDefinition {
  return {
    id: id as never,
    version: '1.0.0' as never,
    name: id,
    description: `Test ${id}`,
    inputs: new Map(),
    outputs: new Map(),
    source: source as never,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 100, esiCallCount: 1 },
  };
}

function makeMockEsiClient() {
  return {
    market: {
      getMarketOrders: vi.fn().mockResolvedValue([
        { order_id: 1, type_id: 34, price: 5.5, is_buy_order: false, volume_remain: 100 },
        { order_id: 2, type_id: 34, price: 4.8, is_buy_order: true, volume_remain: 200 },
      ]),
    },
    route: {
      getRoute: vi.fn().mockResolvedValue([30000142, 30000144, 30000145]),
    },
    universe: {
      getSystemById: vi.fn().mockResolvedValue({
        system_id: 30000142,
        name: 'Jita',
        security_status: 0.9,
      }),
    },
  };
}

describe('EsiAdapter', () => {
  const mockClient = makeMockEsiClient();
  const adapter = new EsiAdapter({ client: mockClient as never });

  it('has name "ESI"', () => {
    expect(adapter.name).toBe('ESI');
  });

  describe('supports', () => {
    it('returns true for ESI capabilities', () => {
      expect(adapter.supports(makeCapability('market.orders', 'ESI'))).toBe(true);
    });

    it('returns false for SDE capabilities', () => {
      expect(adapter.supports(makeCapability('universe.resolve.type', 'SDE'))).toBe(false);
    });

    it('returns false for DERIVED capabilities', () => {
      expect(adapter.supports(makeCapability('market.aggregate', 'DERIVED'))).toBe(false);
    });
  });

  describe('execute', () => {
    it('fetches market orders via EsiClient', async () => {
      const cap = makeCapability('market.orders', 'ESI');
      const inputs = new Map<string, unknown>([['region', 10000002]]);
      const result = await adapter.execute(cap, inputs);

      expect(mockClient.market.getMarketOrders).toHaveBeenCalledWith(10000002);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.provenance.source).toBe('ESI');
    });

    it('calculates route distance via EsiClient', async () => {
      const cap = makeCapability('route.distance', 'ESI');
      const inputs = new Map<string, unknown>([
        ['origin', 30000142],
        ['destination', 30000145],
      ]);
      const result = await adapter.execute(cap, inputs);

      expect(mockClient.route.getRoute).toHaveBeenCalledWith(30000142, 30000145);
      expect(result.data).toBe(2);
    });

    it('resolves location via EsiClient', async () => {
      const cap = makeCapability('universe.resolve.location', 'ESI');
      const inputs = new Map<string, unknown>([['location', 30000142]]);
      const result = await adapter.execute(cap, inputs);

      expect(mockClient.universe.getSystemById).toHaveBeenCalledWith(30000142);
      expect((result.data as Record<string, unknown>).name).toBe('Jita');
    });

    it('throws on missing required input', async () => {
      const cap = makeCapability('market.orders', 'ESI');
      await expect(adapter.execute(cap, new Map())).rejects.toThrow(
        /Missing required numeric input/,
      );
    });

    it('throws on unknown capability', async () => {
      const cap = makeCapability('unknown.capability', 'ESI');
      await expect(adapter.execute(cap, new Map())).rejects.toThrow(/does not handle capability/);
    });
  });
});

describe('EsiAdapter default client', () => {
  it('builds its own client with the fabric user agent when given none', () => {
    expect(() => new EsiAdapter()).not.toThrow();
  });
});
