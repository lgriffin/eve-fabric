import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityCatalog } from '../../src/capability/catalog.js';
import { capabilityId, capabilityVersion } from '../../src/capability/capability-id.js';

function marketOrdersDef(version = 1) {
  return {
    id: 'market.orders',
    version,
    name: 'Market Orders',
    description: 'Fetch market orders for a region and type',
    inputs: {
      regionId: {
        name: 'regionId',
        semanticType: 'eve.region.reference',
        required: true,
      },
      typeId: {
        name: 'typeId',
        semanticType: 'eve.type.reference',
        required: true,
      },
    },
    outputs: {
      orders: {
        name: 'orders',
        semanticType: 'eve.market.order.collection',
        required: true,
      },
    },
    source: 'ESI' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: true, identityInKey: false },
    cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
  };
}

function sdeLookupDef() {
  return {
    id: 'sde.types.lookup',
    version: 1,
    name: 'SDE Type Lookup',
    description: 'Look up type information from the SDE',
    inputs: {
      typeId: {
        name: 'typeId',
        semanticType: 'eve.type.reference',
        required: true,
      },
    },
    outputs: {
      typeName: {
        name: 'typeName',
        semanticType: 'eve.type.reference',
        required: true,
      },
    },
    source: 'SDE' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: {
      cacheable: true,
      defaultTtlSeconds: 86400,
      stalePermitted: true,
      identityInKey: false,
    },
    cost: { estimatedLatencyMs: 5, esiCallCount: 0 },
  };
}

describe('CapabilityCatalog', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
  });

  describe('register', () => {
    it('registers a valid definition', () => {
      catalog.register(marketOrdersDef());
      expect(catalog.has(capabilityId('market.orders'))).toBe(true);
    });

    it('rejects duplicate id@version', () => {
      catalog.register(marketOrdersDef());
      expect(() => catalog.register(marketOrdersDef())).toThrow('already registered');
    });

    it('accepts different versions of the same capability', () => {
      catalog.register(marketOrdersDef(1));
      catalog.register(marketOrdersDef(2));
      expect(catalog.has(capabilityId('market.orders'), capabilityVersion(1))).toBe(true);
      expect(catalog.has(capabilityId('market.orders'), capabilityVersion(2))).toBe(true);
    });

    it('rejects invalid definition', () => {
      expect(() => catalog.register({ id: 'INVALID' })).toThrow('Invalid capability definition');
    });
  });

  describe('get', () => {
    it('retrieves by id and version', () => {
      catalog.register(marketOrdersDef());
      const def = catalog.get(capabilityId('market.orders'), capabilityVersion(1));
      expect(def.name).toBe('Market Orders');
    });

    it('retrieves latest version when version omitted', () => {
      catalog.register(marketOrdersDef(1));
      catalog.register(marketOrdersDef(2));
      const def = catalog.get(capabilityId('market.orders'));
      expect(def.version as number).toBe(2);
    });

    it('throws for unknown capability', () => {
      expect(() => catalog.get(capabilityId('unknown.cap'))).toThrow('not found');
    });

    it('throws for unknown version', () => {
      catalog.register(marketOrdersDef(1));
      expect(() => catalog.get(capabilityId('market.orders'), capabilityVersion(99))).toThrow(
        'not found',
      );
    });
  });

  describe('has', () => {
    it('returns false for unregistered capability', () => {
      expect(catalog.has(capabilityId('unknown.cap'))).toBe(false);
    });

    it('returns true without version if any version exists', () => {
      catalog.register(marketOrdersDef());
      expect(catalog.has(capabilityId('market.orders'))).toBe(true);
    });

    it('returns false for unregistered version', () => {
      catalog.register(marketOrdersDef(1));
      expect(catalog.has(capabilityId('market.orders'), capabilityVersion(99))).toBe(false);
    });
  });

  describe('findBySemanticInput', () => {
    it('finds capabilities by input semantic type', () => {
      catalog.register(marketOrdersDef());
      catalog.register(sdeLookupDef());
      const results = catalog.findBySemanticInput(
        capabilityId(
          'eve.region.reference',
        ) as unknown as import('../../src/semantic-type/semantic-type.js').SemanticTypeId,
      );
      expect(results).toHaveLength(1);
      expect(results[0]!.id as string).toBe('market.orders');
    });

    it('returns empty array when no match', () => {
      catalog.register(marketOrdersDef());
      const results = catalog.findBySemanticInput(
        capabilityId(
          'eve.currency.isk',
        ) as unknown as import('../../src/semantic-type/semantic-type.js').SemanticTypeId,
      );
      expect(results).toHaveLength(0);
    });
  });

  describe('findBySemanticOutput', () => {
    it('finds capabilities by output semantic type', () => {
      catalog.register(marketOrdersDef());
      const results = catalog.findBySemanticOutput(
        capabilityId(
          'eve.market.order.collection',
        ) as unknown as import('../../src/semantic-type/semantic-type.js').SemanticTypeId,
      );
      expect(results).toHaveLength(1);
    });
  });

  describe('findBySource', () => {
    it('finds capabilities by source', () => {
      catalog.register(marketOrdersDef());
      catalog.register(sdeLookupDef());
      const esiCaps = catalog.findBySource('ESI');
      expect(esiCaps).toHaveLength(1);
      expect(esiCaps[0]!.id as string).toBe('market.orders');
    });

    it('returns empty for unmatched source', () => {
      catalog.register(marketOrdersDef());
      expect(catalog.findBySource('DERIVED')).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('searches by id substring', () => {
      catalog.register(marketOrdersDef());
      catalog.register(sdeLookupDef());
      const results = catalog.search('market');
      expect(results).toHaveLength(1);
    });

    it('searches by name', () => {
      catalog.register(marketOrdersDef());
      const results = catalog.search('Market Orders');
      expect(results).toHaveLength(1);
    });

    it('searches case-insensitively', () => {
      catalog.register(marketOrdersDef());
      const results = catalog.search('MARKET');
      expect(results).toHaveLength(1);
    });

    it('returns empty for no match', () => {
      catalog.register(marketOrdersDef());
      expect(catalog.search('nonexistent')).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('returns empty array initially', () => {
      expect(catalog.list()).toHaveLength(0);
    });

    it('returns all registered definitions', () => {
      catalog.register(marketOrdersDef());
      catalog.register(sdeLookupDef());
      expect(catalog.list()).toHaveLength(2);
    });

    it('includes all versions', () => {
      catalog.register(marketOrdersDef(1));
      catalog.register(marketOrdersDef(2));
      expect(catalog.list()).toHaveLength(2);
    });
  });

  describe('normalized output', () => {
    it('converts record inputs to Map', () => {
      catalog.register(marketOrdersDef());
      const def = catalog.get(capabilityId('market.orders'));
      expect(def.inputs).toBeInstanceOf(Map);
      expect(def.inputs.size).toBe(2);
      expect(def.inputs.get('regionId')?.semanticType as string).toBe('eve.region.reference');
    });

    it('converts record outputs to Map', () => {
      catalog.register(marketOrdersDef());
      const def = catalog.get(capabilityId('market.orders'));
      expect(def.outputs).toBeInstanceOf(Map);
      expect(def.outputs.get('orders')?.semanticType as string).toBe('eve.market.order.collection');
    });

    it('preserves auth, cache, and cost fields', () => {
      catalog.register(marketOrdersDef());
      const def = catalog.get(capabilityId('market.orders'));
      expect(def.auth.required).toBe(false);
      expect(def.cache.cacheable).toBe(true);
      expect(def.cache.defaultTtlSeconds).toBe(300);
      expect(def.cost.estimatedLatencyMs).toBe(200);
      expect(def.cost.esiCallCount).toBe(1);
    });
  });
});
