import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCapabilities } from '../src/resolve-capabilities.js';
import {
  CAPABILITY_NOT_FOUND,
  INVALID_CONFIGURED_VALUE,
  MISSING_INPUT,
  UNKNOWN_PIPELINE_INPUT,
} from '../src/diagnostics.js';
import { z } from 'zod';
import {
  CapabilityCatalog,
  SemanticTypeRegistry,
  capabilityId,
  capabilityVersion,
  createSemanticType,
  semanticTypeId,
} from '@eve-fabric/domain';
import type { PipelineDefinition } from '../src/pipeline-types.js';

function marketOrdersDef() {
  return {
    id: 'market.orders',
    version: 1,
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

function priceAggregatorDef() {
  return {
    id: 'price.aggregator',
    version: 1,
    name: 'Price Aggregator',
    description: 'Aggregates market orders into pricing data',
    inputs: {
      orders: {
        name: 'orders',
        semanticType: 'eve.market.order.collection',
        required: true,
      },
    },
    outputs: {
      price: {
        name: 'price',
        semanticType: 'eve.currency.isk',
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

function optionalInputDef() {
  return {
    id: 'optional.cap',
    version: 1,
    name: 'Optional Input Capability',
    description: 'Has an optional input port',
    inputs: {
      required: {
        name: 'required',
        semanticType: 'eve.region.reference',
        required: true,
      },
      optional: {
        name: 'optional',
        semanticType: 'eve.type.reference',
        required: false,
      },
    },
    outputs: {
      result: {
        name: 'result',
        semanticType: 'eve.currency.isk',
        required: true,
      },
    },
    source: 'DERIVED' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
  };
}

describe('resolveCapabilities', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    catalog.register(marketOrdersDef());
    catalog.register(priceAggregatorDef());
    catalog.register(optionalInputDef());
  });

  it('returns no diagnostics when all capabilities exist and inputs are wired', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [
        { name: 'regionId', semanticType: 'eve.region.reference' as any, required: true },
        { name: 'typeId', semanticType: 'eve.type.reference' as any, required: true },
      ],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any, version: 1 as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any, version: 1 as any } },
      ],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
        { from: 'input.typeId', to: 'fetch.typeId' },
        { from: 'fetch.orders', to: 'agg.orders' },
      ],
      outputs: [{ name: 'price', source: 'agg.price' }],
    };

    const diagnostics = resolveCapabilities(pipeline, catalog);
    expect(diagnostics).toHaveLength(0);
  });

  it('reports CAPABILITY_NOT_FOUND for unknown capabilities', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [{ id: 'missing', capability: { id: 'nonexistent.cap' as any } }],
      edges: [],
      outputs: [],
    };

    const diagnostics = resolveCapabilities(pipeline, catalog);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe(CAPABILITY_NOT_FOUND);
    expect(diagnostics[0]!.context?.capability).toBe('nonexistent.cap');
  });

  it('reports MISSING_INPUT for unwired required inputs', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference' as any, required: true }],
      nodes: [{ id: 'fetch', capability: { id: 'market.orders' as any, version: 1 as any } }],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
        // typeId is NOT wired
      ],
      outputs: [],
    };

    const diagnostics = resolveCapabilities(pipeline, catalog);
    const missingInputs = diagnostics.filter((d) => d.code === MISSING_INPUT);
    expect(missingInputs).toHaveLength(1);
    expect(missingInputs[0]!.message).toContain('typeId');
  });

  it('does not report MISSING_INPUT for optional inputs that are unwired', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'region', semanticType: 'eve.region.reference' as any, required: true }],
      nodes: [{ id: 'opt', capability: { id: 'optional.cap' as any, version: 1 as any } }],
      edges: [
        { from: 'input.region', to: 'opt.required' },
        // 'optional' port is NOT wired, but it's not required
      ],
      outputs: [],
    };

    const diagnostics = resolveCapabilities(pipeline, catalog);
    expect(diagnostics).toHaveLength(0);
  });

  it('reports multiple missing inputs on the same node', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [{ id: 'fetch', capability: { id: 'market.orders' as any, version: 1 as any } }],
      edges: [],
      outputs: [],
    };

    const diagnostics = resolveCapabilities(pipeline, catalog);
    const missingInputs = diagnostics.filter((d) => d.code === MISSING_INPUT);
    expect(missingInputs).toHaveLength(2);
    const ports = missingInputs.map((d) => d.location?.field);
    expect(ports).toContain('regionId');
    expect(ports).toContain('typeId');
  });
});

describe('resolveCapabilities: undeclared pipeline inputs', () => {
  it('reports an edge from an undeclared input and does not count it as wiring', () => {
    const catalog = new CapabilityCatalog();
    catalog.register(marketOrdersDef());
    const pipeline = {
      id: 'p',
      version: 1,
      name: 'P',
      inputs: [{ name: 'region', semanticType: 'eve.region.reference', required: true }],
      nodes: [{ id: 'orders', capability: { id: 'market.orders' } }],
      edges: [
        { from: 'input.region', to: 'orders.regionId' },
        { from: 'input.item', to: 'orders.typeId' },
      ],
      outputs: [{ name: 'orders', source: 'orders.orders' }],
    } as unknown as PipelineDefinition;

    const codes = resolveCapabilities(pipeline, catalog).map((d) => d.code);
    expect(codes).toContain(UNKNOWN_PIPELINE_INPUT);
    expect(codes).toContain(MISSING_INPUT);
  });
});

describe('resolveCapabilities: configured values', () => {
  function typedCatalog(): CapabilityCatalog {
    const types = new SemanticTypeRegistry();
    types.register(
      createSemanticType({
        id: 'test.region.reference',
        description: 'A region id',
        schema: z.number().int().positive(),
        category: 't',
      }),
    );
    const catalog = new CapabilityCatalog({ types });
    catalog.register({
      id: capabilityId('test.lookup'),
      version: capabilityVersion('1.0.0'),
      name: 'Lookup',
      description: 'Takes a region, or its name',
      inputs: new Map([
        [
          'region',
          { name: 'region', semanticType: semanticTypeId('test.region.reference'), required: true },
        ],
        [
          'query',
          {
            name: 'query',
            semanticType: semanticTypeId('test.region.reference'),
            required: false,
            acceptsName: true,
          },
        ],
      ]),
      outputs: new Map([
        [
          'out',
          { name: 'out', semanticType: semanticTypeId('test.region.reference'), required: true },
        ],
      ]),
      source: 'DERIVED',
      dependencies: [],
      auth: { required: false, scopes: [] },
      cache: {
        cacheable: false,
        defaultTtlSeconds: 0,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 0, esiCallCount: 0 },
    });
    return catalog;
  }

  const pipeline: PipelineDefinition = {
    id: 'p',
    version: 1,
    name: 'p',
    inputs: [],
    nodes: [{ id: 'n', capability: { id: 'test.lookup', version: '1.0.0' } }],
    edges: [],
    outputs: [{ name: 'out', source: 'n.out' }],
  };

  it('refuses a configured value that is not of its port type', () => {
    const diagnostics = resolveCapabilities(pipeline, typedCatalog(), {
      configuredInputs: { n: { region: 'The Forge' } },
    });
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: INVALID_CONFIGURED_VALUE,
        location: { nodeId: 'n', field: 'region' },
        context: { expectedType: 'test.region.reference' },
      }),
    ]);
  });

  it('accepts a value of the type, a name where the port takes names, and nothing at all', () => {
    expect(
      resolveCapabilities(pipeline, typedCatalog(), {
        configuredInputs: { n: { region: 10000002, query: 'The Forge', other: 'ignored' } },
      }),
    ).toEqual([]);
    expect(
      resolveCapabilities(pipeline, typedCatalog(), {
        configuredInputs: { n: { region: 10000002, query: null } },
      }),
    ).toEqual([]);
  });

  it('checks nothing in a catalog without types', () => {
    const catalog = new CapabilityCatalog();
    catalog.register(typedCatalog().list()[0]!);
    expect(
      resolveCapabilities(pipeline, catalog, { configuredInputs: { n: { region: 'The Forge' } } }),
    ).toEqual([]);
  });
});
