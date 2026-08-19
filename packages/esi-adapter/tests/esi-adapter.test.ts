import { describe, it, expect } from 'vitest';
import { EsiAdapter } from '../src/esi-adapter.js';
import type { CapabilityDefinition } from '@eve-fabric/domain';

function makeCapability(source: string): CapabilityDefinition {
  return {
    id: 'market.orders' as never,
    version: 1 as never,
    name: 'Market Orders',
    description: 'Fetch market orders',
    inputs: new Map(),
    outputs: new Map(),
    source: source as never,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: {
      cacheable: true,
      defaultTtlSeconds: 300,
      stalePermitted: false,
      identityInKey: false,
    },
    cost: { estimatedLatencyMs: 100, esiCallCount: 1 },
  };
}

describe('EsiAdapter', () => {
  const adapter = new EsiAdapter();

  it('has name "ESI"', () => {
    expect(adapter.name).toBe('ESI');
  });

  describe('supports', () => {
    it('returns true for ESI capabilities', () => {
      const cap = makeCapability('ESI');
      expect(adapter.supports(cap)).toBe(true);
    });

    it('returns false for SDE capabilities', () => {
      const cap = makeCapability('SDE');
      expect(adapter.supports(cap)).toBe(false);
    });

    it('returns false for DERIVED capabilities', () => {
      const cap = makeCapability('DERIVED');
      expect(adapter.supports(cap)).toBe(false);
    });
  });

  describe('execute', () => {
    it('throws "not yet connected" error', async () => {
      const cap = makeCapability('ESI');
      await expect(
        adapter.execute(cap, new Map()),
      ).rejects.toThrow('ESI adapter not yet connected to ESI.ts');
    });
  });
});
