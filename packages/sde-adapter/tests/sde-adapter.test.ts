import { describe, it, expect } from 'vitest';
import { SdeAdapter } from '../src/sde-adapter.js';
import type { CapabilityDefinition } from '@eve-fabric/domain';

function makeCapability(source: string): CapabilityDefinition {
  return {
    id: 'sde.types' as never,
    version: 1 as never,
    name: 'SDE Types',
    description: 'Lookup SDE type data',
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

describe('SdeAdapter', () => {
  const adapter = new SdeAdapter();

  it('has name "SDE"', () => {
    expect(adapter.name).toBe('SDE');
  });

  describe('supports', () => {
    it('returns true for SDE capabilities', () => {
      const cap = makeCapability('SDE');
      expect(adapter.supports(cap)).toBe(true);
    });

    it('returns false for ESI capabilities', () => {
      const cap = makeCapability('ESI');
      expect(adapter.supports(cap)).toBe(false);
    });

    it('returns false for DERIVED capabilities', () => {
      const cap = makeCapability('DERIVED');
      expect(adapter.supports(cap)).toBe(false);
    });
  });

  describe('execute', () => {
    it('throws "not yet connected" error', async () => {
      const cap = makeCapability('SDE');
      await expect(adapter.execute(cap, new Map())).rejects.toThrow(
        'SDE adapter not yet connected to data provider',
      );
    });
  });
});
