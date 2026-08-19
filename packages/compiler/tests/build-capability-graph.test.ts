import { describe, it, expect, beforeEach } from 'vitest';
import { buildCapabilityGraph } from '../src/build-capability-graph.js';
import { CapabilityCatalog } from '@eve-fabric/domain';
import type { PipelineDefinition } from '../src/pipeline-types.js';

function marketOrdersDef() {
  return {
    id: 'market.orders',
    version: 1,
    name: 'Market Orders',
    description: 'Fetch market orders',
    inputs: {
      regionId: { name: 'regionId', semanticType: 'eve.region.reference', required: true },
    },
    outputs: {
      orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
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
    description: 'Aggregate orders into price',
    inputs: {
      orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
    },
    outputs: {
      price: { name: 'price', semanticType: 'eve.currency.isk', required: true },
    },
    source: 'DERIVED' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 50, esiCallCount: 0 },
  };
}

function sdeLookupDef() {
  return {
    id: 'sde.types.lookup',
    version: 1,
    name: 'SDE Type Lookup',
    description: 'Look up type info from SDE',
    inputs: {
      typeId: { name: 'typeId', semanticType: 'eve.type.reference', required: true },
    },
    outputs: {
      typeName: { name: 'typeName', semanticType: 'eve.type.name', required: true },
    },
    source: 'SDE' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 86400, stalePermitted: true, identityInKey: false },
    cost: { estimatedLatencyMs: 5, esiCallCount: 0 },
  };
}

describe('buildCapabilityGraph', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    catalog.register(marketOrdersDef());
    catalog.register(priceAggregatorDef());
    catalog.register(sdeLookupDef());
  });

  it('builds a linear graph with correct step ordering', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [
        { name: 'regionId', semanticType: 'eve.region.reference' as any, required: true },
      ],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any } },
      ],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
        { from: 'fetch.orders', to: 'agg.orders' },
      ],
      outputs: [{ name: 'price', source: 'agg.price' }],
    };

    const graph = buildCapabilityGraph(pipeline, catalog);
    expect(graph.steps).toHaveLength(2);
    // fetch must come before agg
    const fetchIdx = graph.steps.findIndex((s) => s.id === 'fetch');
    const aggIdx = graph.steps.findIndex((s) => s.id === 'agg');
    expect(fetchIdx).toBeLessThan(aggIdx);
  });

  it('detects dependencies from edges', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [
        { name: 'regionId', semanticType: 'eve.region.reference' as any, required: true },
      ],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any } },
      ],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
        { from: 'fetch.orders', to: 'agg.orders' },
      ],
      outputs: [{ name: 'price', source: 'agg.price' }],
    };

    const graph = buildCapabilityGraph(pipeline, catalog);
    const aggStep = graph.steps.find((s) => s.id === 'agg');
    expect(aggStep).toBeDefined();
    expect(aggStep!.dependsOn).toContain('fetch');

    const fetchStep = graph.steps.find((s) => s.id === 'fetch');
    expect(fetchStep).toBeDefined();
    expect(fetchStep!.dependsOn).toHaveLength(0);
  });

  it('groups independent nodes into parallel groups', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [
        { name: 'regionId', semanticType: 'eve.region.reference' as any, required: true },
        { name: 'typeId', semanticType: 'eve.type.reference' as any, required: true },
      ],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
        { id: 'lookup', capability: { id: 'sde.types.lookup' as any } },
      ],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
        { from: 'input.typeId', to: 'lookup.typeId' },
      ],
      outputs: [
        { name: 'orders', source: 'fetch.orders' },
        { name: 'typeName', source: 'lookup.typeName' },
      ],
    };

    const graph = buildCapabilityGraph(pipeline, catalog);
    expect(graph.parallelGroups).toHaveLength(1);
    expect(graph.parallelGroups[0]!.steps).toHaveLength(2);
    expect(graph.parallelGroups[0]!.canParallelize).toBe(true);
  });

  it('creates correct input bindings for pipeline inputs', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [
        { name: 'regionId', semanticType: 'eve.region.reference' as any, required: true },
      ],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
      ],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
      ],
      outputs: [{ name: 'orders', source: 'fetch.orders' }],
    };

    const graph = buildCapabilityGraph(pipeline, catalog);
    const fetchStep = graph.steps.find((s) => s.id === 'fetch');
    expect(fetchStep).toBeDefined();
    const binding = fetchStep!.inputs.find((b) => b.portName === 'regionId');
    expect(binding).toBeDefined();
    expect(binding!.source).toBe('pipeline-input');
    expect(binding!.pipelineInputName).toBe('regionId');
  });

  it('creates correct input bindings for step outputs', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [
        { name: 'regionId', semanticType: 'eve.region.reference' as any, required: true },
      ],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any } },
      ],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
        { from: 'fetch.orders', to: 'agg.orders' },
      ],
      outputs: [{ name: 'price', source: 'agg.price' }],
    };

    const graph = buildCapabilityGraph(pipeline, catalog);
    const aggStep = graph.steps.find((s) => s.id === 'agg');
    expect(aggStep).toBeDefined();
    const binding = aggStep!.inputs.find((b) => b.portName === 'orders');
    expect(binding).toBeDefined();
    expect(binding!.source).toBe('step-output');
    expect(binding!.stepId).toBe('fetch');
    expect(binding!.outputPortName).toBe('orders');
  });

  it('produces multiple parallel groups for a diamond graph', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [
        { name: 'regionId', semanticType: 'eve.region.reference' as any, required: true },
        { name: 'typeId', semanticType: 'eve.type.reference' as any, required: true },
      ],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
        { id: 'lookup', capability: { id: 'sde.types.lookup' as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any } },
      ],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
        { from: 'input.typeId', to: 'lookup.typeId' },
        { from: 'fetch.orders', to: 'agg.orders' },
      ],
      outputs: [{ name: 'price', source: 'agg.price' }],
    };

    const graph = buildCapabilityGraph(pipeline, catalog);
    // First group: fetch and lookup (independent), second group: agg (depends on fetch)
    expect(graph.parallelGroups.length).toBeGreaterThanOrEqual(2);
    // First group should have fetch and lookup
    const firstGroup = graph.parallelGroups[0]!;
    expect(firstGroup.steps).toContain('fetch');
    expect(firstGroup.steps).toContain('lookup');
    expect(firstGroup.canParallelize).toBe(true);
  });

  it('handles an empty pipeline', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [],
      edges: [],
      outputs: [],
    };

    const graph = buildCapabilityGraph(pipeline, catalog);
    expect(graph.steps).toHaveLength(0);
    expect(graph.parallelGroups).toHaveLength(0);
  });
});
