import { describe, it, expect, vi } from 'vitest';
import { SdeAdapter } from '../src/sde-adapter.js';
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
    cache: {
      cacheable: true,
      defaultTtlSeconds: 86400,
      stalePermitted: true,
      identityInKey: false,
    },
    cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
  };
}

function makeMockSdeProvider() {
  return {
    getType: vi.fn().mockReturnValue({ typeID: 34, typeName: 'Tritanium', groupID: 18 }),
    searchTypesByName: vi
      .fn()
      .mockReturnValue([{ typeID: 34, typeName: 'Tritanium', groupID: 18 }]),
    getRegion: vi.fn().mockReturnValue({ regionId: 10000002, name: 'The Forge' }),
    getAllRegions: vi.fn().mockReturnValue([
      { regionId: 10000002, name: 'The Forge' },
      { regionId: 10000043, name: 'Domain' },
    ]),
    getSolarSystem: vi.fn().mockReturnValue({ solarSystemID: 30000142, solarSystemName: 'Jita' }),
    searchSolarSystemsByName: vi
      .fn()
      .mockReturnValue([{ solarSystemID: 30000142, solarSystemName: 'Jita' }]),
    getVersion: vi.fn().mockReturnValue({ version: '1.0' }),
    close: vi.fn(),
  };
}

describe('SdeAdapter', () => {
  const mockProvider = makeMockSdeProvider();
  const adapter = new SdeAdapter({ provider: mockProvider as never });

  it('has name "SDE"', () => {
    expect(adapter.name).toBe('SDE');
  });

  describe('supports', () => {
    it('returns true for SDE capabilities', () => {
      expect(adapter.supports(makeCapability('universe.resolve.type', 'SDE'))).toBe(true);
    });

    it('returns false for ESI capabilities', () => {
      expect(adapter.supports(makeCapability('market.orders', 'ESI'))).toBe(false);
    });

    it('returns false for DERIVED capabilities', () => {
      expect(adapter.supports(makeCapability('market.aggregate', 'DERIVED'))).toBe(false);
    });
  });

  describe('execute', () => {
    it('resolves type by numeric ID', async () => {
      const cap = makeCapability('universe.resolve.type', 'SDE');
      const inputs = new Map<string, unknown>([['query', 34]]);
      const result = await adapter.execute(cap, inputs);

      expect(mockProvider.getType).toHaveBeenCalledWith(34);
      expect((result.data as Record<string, unknown>).typeName).toBe('Tritanium');
      expect(result.provenance.source).toBe('SDE');
    });

    it('resolves type by name search', async () => {
      const cap = makeCapability('universe.resolve.type', 'SDE');
      const inputs = new Map<string, unknown>([['query', 'Tritanium']]);
      const result = await adapter.execute(cap, inputs);

      expect(mockProvider.searchTypesByName).toHaveBeenCalledWith('Tritanium', 1);
      expect((result.data as Record<string, unknown>).typeName).toBe('Tritanium');
    });

    it('resolves region by numeric ID', async () => {
      const cap = makeCapability('universe.resolve.region', 'SDE');
      const inputs = new Map<string, unknown>([['query', 10000002]]);
      const result = await adapter.execute(cap, inputs);

      expect(mockProvider.getRegion).toHaveBeenCalledWith(10000002);
      expect((result.data as Record<string, unknown>).name).toBe('The Forge');
    });

    it('resolves solar system by numeric ID', async () => {
      const cap = makeCapability('universe.resolve.solar.system', 'SDE');
      const inputs = new Map<string, unknown>([['query', 30000142]]);
      const result = await adapter.execute(cap, inputs);

      expect(mockProvider.getSolarSystem).toHaveBeenCalledWith(30000142);
      expect((result.data as Record<string, unknown>).solarSystemName).toBe('Jita');
    });

    it('resolves solar system by name search', async () => {
      const cap = makeCapability('universe.resolve.solar.system', 'SDE');
      const inputs = new Map<string, unknown>([['query', 'Jita']]);
      await adapter.execute(cap, inputs);

      expect(mockProvider.searchSolarSystemsByName).toHaveBeenCalledWith('Jita', 1);
    });

    it('resolves region by name search', async () => {
      const cap = makeCapability('universe.resolve.region', 'SDE');
      const inputs = new Map<string, unknown>([['query', 'The Forge']]);
      const result = await adapter.execute(cap, inputs);

      expect(mockProvider.getAllRegions).toHaveBeenCalled();
      expect((result.data as Record<string, unknown>).name).toBe('The Forge');
    });

    it('throws when type query is neither number nor string', async () => {
      const cap = makeCapability('universe.resolve.type', 'SDE');
      const inputs = new Map<string, unknown>([['query', true]]);
      await expect(adapter.execute(cap, inputs)).rejects.toThrow(/numeric ID or string name/);
    });

    it('throws when region query is neither number nor string', async () => {
      const cap = makeCapability('universe.resolve.region', 'SDE');
      const inputs = new Map<string, unknown>([['query', true]]);
      await expect(adapter.execute(cap, inputs)).rejects.toThrow(/numeric ID or string name/);
    });

    it('throws when solar system query is neither number nor string', async () => {
      const cap = makeCapability('universe.resolve.solar.system', 'SDE');
      const inputs = new Map<string, unknown>([['query', true]]);
      await expect(adapter.execute(cap, inputs)).rejects.toThrow(/numeric ID or string name/);
    });

    it('throws on unknown capability', async () => {
      const cap = makeCapability('unknown.capability', 'SDE');
      await expect(adapter.execute(cap, new Map())).rejects.toThrow(/does not handle capability/);
    });
  });
});
