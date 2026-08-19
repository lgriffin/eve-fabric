import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCapabilities } from '../src/resolve-capabilities.js';
import { CAPABILITY_NOT_FOUND, MISSING_INPUT } from '../src/diagnostics.js';
import { CapabilityCatalog } from '@eve-fabric/domain';
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
      nodes: [
        { id: 'missing', capability: { id: 'nonexistent.cap' as any } },
      ],
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
      inputs: [
        { name: 'regionId', semanticType: 'eve.region.reference' as any, required: true },
      ],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any, version: 1 as any } },
      ],
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
      inputs: [
        { name: 'region', semanticType: 'eve.region.reference' as any, required: true },
      ],
      nodes: [
        { id: 'opt', capability: { id: 'optional.cap' as any, version: 1 as any } },
      ],
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
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any, version: 1 as any } },
      ],
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
