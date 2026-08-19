import { describe, it, expect } from 'vitest';
import {
  defineCapability,
  allCapabilities,
  parseCapabilityManifest,
  parseCapabilityManifests,
} from '../src/index.js';

describe('defineCapability', () => {
  it('creates a capability with required fields', () => {
    const cap = defineCapability({
      id: 'test.capability',
      version: 1,
      name: 'Test Capability',
      description: 'A test capability',
      inputs: {
        item: { type: 'eve.type.reference', description: 'An item', required: true },
      },
      outputs: {
        result: { type: 'eve.market.order', description: 'Order data' },
      },
      source: 'ESI',
    });

    expect(cap.id).toBe('test.capability');
    expect(cap.version as string).toBe('1.0.0');
    expect(cap.name).toBe('Test Capability');
    expect(cap.source).toBe('ESI');
    expect(cap.inputs.get('item')).toBeDefined();
    expect(cap.outputs.get('result')).toBeDefined();
  });

  it('applies default values for optional fields', () => {
    const cap = defineCapability({
      id: 'test.defaults',
      version: 1,
      name: 'Defaults',
      description: '',
      inputs: {},
      outputs: { out: { type: 'eve.currency.isk' } },
      source: 'SDE',
    });

    expect(cap.auth.required).toBe(false);
    expect(cap.auth.scopes).toEqual([]);
    expect(cap.cache.cacheable).toBe(false);
    expect(cap.cost.estimatedLatencyMs).toBe(0);
    expect(cap.dependencies).toEqual([]);
  });

  it('preserves auth and cache configuration', () => {
    const cap = defineCapability({
      id: 'test.auth',
      version: 1,
      name: 'Auth Cap',
      description: '',
      inputs: {},
      outputs: { out: { type: 'eve.currency.isk' } },
      source: 'ESI',
      auth: { required: true, scopes: ['esi-markets.read_markets.v1'] },
      cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: true, identityInKey: true },
    });

    expect(cap.auth.required).toBe(true);
    expect(cap.auth.scopes).toEqual(['esi-markets.read_markets.v1']);
    expect(cap.cache.cacheable).toBe(true);
    expect(cap.cache.defaultTtlSeconds).toBe(300);
  });
});

describe('allCapabilities', () => {
  it('exports 10 initial capabilities', () => {
    expect(allCapabilities).toHaveLength(10);
  });

  it('includes all expected capability IDs', () => {
    const ids = allCapabilities.map((c) => c.id);
    expect(ids).toContain('universe.resolve.type');
    expect(ids).toContain('universe.resolve.region');
    expect(ids).toContain('market.orders');
    expect(ids).toContain('market.aggregate');
    expect(ids).toContain('route.distance');
    expect(ids).toContain('collection.filter');
    expect(ids).toContain('collection.sort');
    expect(ids).toContain('collection.limit');
  });

  it('every capability has at least one output', () => {
    for (const cap of allCapabilities) {
      expect(cap.outputs.size).toBeGreaterThan(0);
    }
  });
});

describe('parseCapabilityManifest', () => {
  it('parses a YAML manifest into a CapabilityDefinition', () => {
    const yaml = `
id: test.parse
version: 1
name: Parse Test
description: Testing YAML parsing
source: ESI
inputs:
  item:
    type: eve.type.reference
    description: Item ref
outputs:
  result:
    type: eve.market.order
    description: Market order
`;
    const cap = parseCapabilityManifest(yaml);
    expect(cap.id).toBe('test.parse');
    expect(cap.version as string).toBe('1.0.0');
    expect(cap.inputs.get('item')?.semanticType).toBe('eve.type.reference');
    expect(cap.outputs.get('result')?.semanticType).toBe('eve.market.order');
  });

  it('throws on missing required fields', () => {
    const yaml = `
name: Missing ID
source: ESI
outputs:
  result:
    type: eve.market.order
`;
    expect(() => parseCapabilityManifest(yaml)).toThrow('missing required field');
  });
});

describe('parseCapabilityManifests', () => {
  it('parses multi-document YAML', () => {
    const yaml = `
id: cap.one
version: 1
source: ESI
outputs:
  out:
    type: eve.currency.isk
---
id: cap.two
version: 1
source: SDE
outputs:
  out:
    type: eve.type.reference
`;
    const caps = parseCapabilityManifests(yaml);
    expect(caps).toHaveLength(2);
    expect(caps[0]!.id).toBe('cap.one');
    expect(caps[1]!.id).toBe('cap.two');
  });
});
