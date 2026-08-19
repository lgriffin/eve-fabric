import { describe, it, expect, beforeEach } from 'vitest';
import { suggestIntermediates } from '../src/suggest-intermediates.js';
import { SEMANTIC_SUGGESTION } from '../src/diagnostics.js';
import { CapabilityCatalog, DiscoveryEngine } from '@eve-fabric/domain';

function bridgingCapDef() {
  return {
    id: 'transform.region.to.orders',
    version: 1,
    name: 'Region to Orders Transform',
    description: 'Transforms a region reference into market order collection',
    inputs: {
      region: {
        name: 'region',
        semanticType: 'eve.region.reference',
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
    source: 'DERIVED' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 50, esiCallCount: 0 },
  };
}

function unrelatedCapDef() {
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

describe('suggestIntermediates', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
  });

  it('finds a bridging capability when one exists', () => {
    catalog.register(bridgingCapDef());
    catalog.register(unrelatedCapDef());

    const diagnostics = suggestIntermediates(
      'eve.region.reference',
      'eve.market.order.collection',
      catalog,
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe(SEMANTIC_SUGGESTION);
    expect(diagnostics[0]!.context?.capability).toBe('transform.region.to.orders');
  });

  it('returns no suggestions when no bridging capability exists', () => {
    catalog.register(unrelatedCapDef());

    const diagnostics = suggestIntermediates(
      'eve.region.reference',
      'eve.market.order.collection',
      catalog,
    );

    expect(diagnostics).toHaveLength(0);
  });

  it('returns multiple suggestions when multiple bridges exist', () => {
    catalog.register(bridgingCapDef());

    // Register a second bridging capability
    catalog.register({
      id: 'market.orders.fetcher',
      version: 1,
      name: 'Market Orders Fetcher',
      description: 'Another way to get orders from a region',
      inputs: {
        regionRef: {
          name: 'regionRef',
          semanticType: 'eve.region.reference',
          required: true,
        },
      },
      outputs: {
        orderList: {
          name: 'orderList',
          semanticType: 'eve.market.order.collection',
          required: true,
        },
      },
      source: 'ESI' as const,
      dependencies: [],
      auth: { required: false, scopes: [] },
      cache: {
        cacheable: true,
        defaultTtlSeconds: 300,
        stalePermitted: true,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
    });

    const diagnostics = suggestIntermediates(
      'eve.region.reference',
      'eve.market.order.collection',
      catalog,
    );

    expect(diagnostics).toHaveLength(2);
    diagnostics.forEach((d) => {
      expect(d.code).toBe(SEMANTIC_SUGGESTION);
    });
  });

  describe('with DiscoveryEngine delegation', () => {
    it('finds multi-hop bridging via discovery engine', () => {
      // Register capabilities forming a chain: A -> B -> C
      catalog.register({
        id: 'bridge.a.to.b',
        version: 1,
        name: 'A to B Bridge',
        description: 'Converts A to B',
        inputs: { input: { name: 'input', semanticType: 'eve.region.reference', required: true } },
        outputs: {
          output: { name: 'output', semanticType: 'eve.location.reference', required: true },
        },
        source: 'DERIVED' as const,
        dependencies: [],
        auth: { required: false, scopes: [] },
        cache: {
          cacheable: false,
          defaultTtlSeconds: 0,
          stalePermitted: false,
          identityInKey: false,
        },
        cost: { estimatedLatencyMs: 50, esiCallCount: 0 },
      });
      catalog.register({
        id: 'bridge.b.to.c',
        version: 1,
        name: 'B to C Bridge',
        description: 'Converts B to C',
        inputs: {
          input: { name: 'input', semanticType: 'eve.location.reference', required: true },
        },
        outputs: {
          output: { name: 'output', semanticType: 'eve.market.order.collection', required: true },
        },
        source: 'DERIVED' as const,
        dependencies: [],
        auth: { required: false, scopes: [] },
        cache: {
          cacheable: false,
          defaultTtlSeconds: 0,
          stalePermitted: false,
          identityInKey: false,
        },
        cost: { estimatedLatencyMs: 50, esiCallCount: 0 },
      });

      const engine = new DiscoveryEngine(catalog);
      const diagnostics = suggestIntermediates(
        'eve.region.reference',
        'eve.market.order.collection',
        catalog,
        engine,
      );

      expect(diagnostics.length).toBeGreaterThanOrEqual(2);
      diagnostics.forEach((d) => {
        expect(d.code).toBe(SEMANTIC_SUGGESTION);
      });
    });

    it('falls back to linear scan without discovery engine', () => {
      catalog.register(bridgingCapDef());
      const diagnostics = suggestIntermediates(
        'eve.region.reference',
        'eve.market.order.collection',
        catalog,
      );
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.context?.capability).toBe('transform.region.to.orders');
    });
  });

  it('does not suggest capabilities that only match input but not output', () => {
    // This capability accepts region.reference but outputs something else
    catalog.register({
      id: 'region.info.lookup',
      version: 1,
      name: 'Region Info',
      description: 'Looks up region info',
      inputs: {
        region: {
          name: 'region',
          semanticType: 'eve.region.reference',
          required: true,
        },
      },
      outputs: {
        info: {
          name: 'info',
          semanticType: 'eve.type.reference',
          required: true,
        },
      },
      source: 'SDE' as const,
      dependencies: [],
      auth: { required: false, scopes: [] },
      cache: {
        cacheable: true,
        defaultTtlSeconds: 3600,
        stalePermitted: true,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
    });

    const diagnostics = suggestIntermediates(
      'eve.region.reference',
      'eve.market.order.collection',
      catalog,
    );

    expect(diagnostics).toHaveLength(0);
  });
});
