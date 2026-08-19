import { describe, it, expect, beforeEach } from 'vitest';
import { resolveComposites, expandCompositeNode } from '../src/resolve-composite.js';
import type { PipelineRegistry } from '../src/resolve-composite.js';
import type { PipelineDefinition } from '../src/pipeline-types.js';
import { CapabilityCatalog } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion, semanticTypeId } from '@eve-fabric/domain';

function makeRawCap(
  id: string,
  version: number,
  source: string,
  inputs: Record<string, { name: string; semanticType: string; required: boolean }>,
  outputs: Record<string, { name: string; semanticType: string; required: boolean }>,
  pipelineRef?: { id: string; version: number },
) {
  return {
    id,
    version,
    name: id,
    description: `Test capability ${id}`,
    inputs,
    outputs,
    source,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 100, esiCallCount: source === 'ESI' ? 1 : 0 },
    pipelineRef,
  };
}

function makeRegistry(pipelines: Map<string, PipelineDefinition>): PipelineRegistry {
  return {
    get(id: string, version: number): PipelineDefinition | undefined {
      return pipelines.get(`${id}@${version}`);
    },
  };
}

describe('resolveComposites', () => {
  let catalog: CapabilityCatalog;
  let registry: PipelineRegistry;

  const snapshotPipeline: PipelineDefinition = {
    id: 'market-snapshot',
    version: 1,
    name: 'Market Snapshot',
    inputs: [
      { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
      { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
    ],
    nodes: [
      {
        id: 'orders',
        capability: { id: capabilityId('market.orders'), version: capabilityVersion(1) },
      },
      {
        id: 'aggregate',
        capability: { id: capabilityId('market.aggregate'), version: capabilityVersion(1) },
      },
    ],
    edges: [
      { from: 'input.item', to: 'orders.item' },
      { from: 'input.region', to: 'orders.region' },
      { from: 'orders.orders', to: 'aggregate.orders' },
    ],
    outputs: [
      { name: 'lowestSell', source: 'aggregate.lowestSell' },
      { name: 'highestBuy', source: 'aggregate.highestBuy' },
    ],
  };

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    catalog.register(
      makeRawCap(
        'universe.resolvetype',
        1,
        'ESI',
        { item: { name: 'item', semanticType: 'eve.type.reference', required: true } },
        { type: { name: 'type', semanticType: 'eve.type.info', required: true } },
      ),
    );
    catalog.register(
      makeRawCap(
        'market.orders',
        1,
        'ESI',
        {
          item: { name: 'item', semanticType: 'eve.type.reference', required: true },
          region: { name: 'region', semanticType: 'eve.region.reference', required: true },
        },
        { orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true } },
      ),
    );
    catalog.register(
      makeRawCap(
        'market.aggregate',
        1,
        'DERIVED',
        { orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true } },
        {
          lowestSell: { name: 'lowestSell', semanticType: 'eve.currency.isk', required: true },
          highestBuy: { name: 'highestBuy', semanticType: 'eve.currency.isk', required: true },
        },
      ),
    );
    catalog.register(
      makeRawCap(
        'market.snapshot',
        1,
        'COMPOSITE',
        {
          item: { name: 'item', semanticType: 'eve.type.reference', required: true },
          region: { name: 'region', semanticType: 'eve.region.reference', required: true },
        },
        {
          lowestSell: { name: 'lowestSell', semanticType: 'eve.currency.isk', required: true },
          highestBuy: { name: 'highestBuy', semanticType: 'eve.currency.isk', required: true },
        },
        { id: 'market-snapshot', version: 1 },
      ),
    );

    const pipelines = new Map<string, PipelineDefinition>();
    pipelines.set('market-snapshot@1', snapshotPipeline);
    registry = makeRegistry(pipelines);
  });

  it('expands a composite node into sub-steps', () => {
    const pipeline: PipelineDefinition = {
      id: 'trade-opportunity',
      version: 1,
      name: 'Trade Opportunity',
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
        { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
      ],
      nodes: [
        {
          id: 'snapshot',
          capability: { id: capabilityId('market.snapshot'), version: capabilityVersion(1) },
        },
      ],
      edges: [
        { from: 'input.item', to: 'snapshot.item' },
        { from: 'input.region', to: 'snapshot.region' },
      ],
      outputs: [{ name: 'lowestSell', source: 'snapshot.lowestSell' }],
    };

    const result = resolveComposites(pipeline, catalog, registry);
    expect(result.diagnostics).toHaveLength(0);

    const nodeIds = result.expandedPipeline.nodes.map((n) => n.id);
    expect(nodeIds).toContain('snapshot/orders');
    expect(nodeIds).toContain('snapshot/aggregate');
    expect(nodeIds).not.toContain('snapshot');
  });

  it('preserves non-composite nodes unchanged', () => {
    const pipeline: PipelineDefinition = {
      id: 'mixed-pipeline',
      version: 1,
      name: 'Mixed Pipeline',
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
        { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
      ],
      nodes: [
        {
          id: 'resolve',
          capability: { id: capabilityId('universe.resolvetype'), version: capabilityVersion(1) },
        },
        {
          id: 'snapshot',
          capability: { id: capabilityId('market.snapshot'), version: capabilityVersion(1) },
        },
      ],
      edges: [
        { from: 'input.item', to: 'resolve.item' },
        { from: 'input.item', to: 'snapshot.item' },
        { from: 'input.region', to: 'snapshot.region' },
      ],
      outputs: [
        { name: 'type', source: 'resolve.type' },
        { name: 'lowestSell', source: 'snapshot.lowestSell' },
      ],
    };

    const result = resolveComposites(pipeline, catalog, registry);
    expect(result.diagnostics).toHaveLength(0);

    const nodeIds = result.expandedPipeline.nodes.map((n) => n.id);
    expect(nodeIds).toContain('resolve');
    expect(nodeIds).toContain('snapshot/orders');
    expect(nodeIds).toContain('snapshot/aggregate');
  });

  it('reports error when composite pipeline is not found in registry', () => {
    const emptyRegistry = makeRegistry(new Map());

    const pipeline: PipelineDefinition = {
      id: 'test',
      version: 1,
      name: 'Test',
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
        { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
      ],
      nodes: [
        {
          id: 'snapshot',
          capability: { id: capabilityId('market.snapshot'), version: capabilityVersion(1) },
        },
      ],
      edges: [
        { from: 'input.item', to: 'snapshot.item' },
        { from: 'input.region', to: 'snapshot.region' },
      ],
      outputs: [{ name: 'lowestSell', source: 'snapshot.lowestSell' }],
    };

    const result = resolveComposites(pipeline, catalog, emptyRegistry);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics.some((d) => d.code === 'COMPOSITE_PIPELINE_NOT_FOUND')).toBe(true);
  });

  it('rewires edges through composite node to sub-pipeline internals', () => {
    const pipeline: PipelineDefinition = {
      id: 'trade-opportunity',
      version: 1,
      name: 'Trade Opportunity',
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
        { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
      ],
      nodes: [
        {
          id: 'snapshot',
          capability: { id: capabilityId('market.snapshot'), version: capabilityVersion(1) },
        },
      ],
      edges: [
        { from: 'input.item', to: 'snapshot.item' },
        { from: 'input.region', to: 'snapshot.region' },
      ],
      outputs: [{ name: 'lowestSell', source: 'snapshot.lowestSell' }],
    };

    const result = resolveComposites(pipeline, catalog, registry);
    const edges = result.expandedPipeline.edges;

    // input.item should be rewired to snapshot/orders.item (sub-pipeline's internal target)
    expect(edges.some((e) => e.from === 'input.item' && e.to === 'snapshot/orders.item')).toBe(
      true,
    );
    // input.region should be rewired to snapshot/orders.region
    expect(edges.some((e) => e.from === 'input.region' && e.to === 'snapshot/orders.region')).toBe(
      true,
    );
    // Internal edge: snapshot/orders.orders -> snapshot/aggregate.orders
    expect(
      edges.some(
        (e) => e.from === 'snapshot/orders.orders' && e.to === 'snapshot/aggregate.orders',
      ),
    ).toBe(true);
    // No edges should reference the original composite node ID directly
    expect(
      edges.every((e) => !e.from.startsWith('snapshot.') && !e.to.startsWith('snapshot.')),
    ).toBe(true);
  });

  it('rewires edges from composite outputs to downstream nodes', () => {
    catalog.register(
      makeRawCap(
        'collection.filter',
        1,
        'DERIVED',
        { data: { name: 'data', semanticType: 'eve.currency.isk', required: true } },
        { filtered: { name: 'filtered', semanticType: 'eve.currency.isk', required: true } },
      ),
    );

    const pipeline: PipelineDefinition = {
      id: 'filtered-snapshot',
      version: 1,
      name: 'Filtered Snapshot',
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
        { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
      ],
      nodes: [
        {
          id: 'snapshot',
          capability: { id: capabilityId('market.snapshot'), version: capabilityVersion(1) },
        },
        {
          id: 'filter',
          capability: { id: capabilityId('collection.filter'), version: capabilityVersion(1) },
        },
      ],
      edges: [
        { from: 'input.item', to: 'snapshot.item' },
        { from: 'input.region', to: 'snapshot.region' },
        { from: 'snapshot.lowestSell', to: 'filter.data' },
      ],
      outputs: [{ name: 'filtered', source: 'filter.filtered' }],
    };

    const result = resolveComposites(pipeline, catalog, registry);
    const edges = result.expandedPipeline.edges;

    // snapshot.lowestSell -> filter.data should be rewired to snapshot/aggregate.lowestSell -> filter.data
    expect(
      edges.some((e) => e.from === 'snapshot/aggregate.lowestSell' && e.to === 'filter.data'),
    ).toBe(true);
  });
});

describe('expandCompositeNode', () => {
  let catalog: CapabilityCatalog;
  let registry: PipelineRegistry;

  const snapshotPipeline: PipelineDefinition = {
    id: 'market-snapshot',
    version: 1,
    name: 'Market Snapshot',
    inputs: [
      { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
      { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
    ],
    nodes: [
      {
        id: 'orders',
        capability: { id: capabilityId('market.orders'), version: capabilityVersion(1) },
      },
      {
        id: 'aggregate',
        capability: { id: capabilityId('market.aggregate'), version: capabilityVersion(1) },
      },
    ],
    edges: [
      { from: 'input.item', to: 'orders.item' },
      { from: 'input.region', to: 'orders.region' },
      { from: 'orders.orders', to: 'aggregate.orders' },
    ],
    outputs: [
      { name: 'lowestSell', source: 'aggregate.lowestSell' },
      { name: 'highestBuy', source: 'aggregate.highestBuy' },
    ],
  };

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    catalog.register(
      makeRawCap(
        'market.orders',
        1,
        'ESI',
        {
          item: { name: 'item', semanticType: 'eve.type.reference', required: true },
          region: { name: 'region', semanticType: 'eve.region.reference', required: true },
        },
        { orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true } },
      ),
    );
    catalog.register(
      makeRawCap(
        'market.aggregate',
        1,
        'DERIVED',
        { orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true } },
        {
          lowestSell: { name: 'lowestSell', semanticType: 'eve.currency.isk', required: true },
          highestBuy: { name: 'highestBuy', semanticType: 'eve.currency.isk', required: true },
        },
      ),
    );
    catalog.register(
      makeRawCap(
        'market.snapshot',
        1,
        'COMPOSITE',
        {
          item: { name: 'item', semanticType: 'eve.type.reference', required: true },
          region: { name: 'region', semanticType: 'eve.region.reference', required: true },
        },
        {
          lowestSell: { name: 'lowestSell', semanticType: 'eve.currency.isk', required: true },
          highestBuy: { name: 'highestBuy', semanticType: 'eve.currency.isk', required: true },
        },
        { id: 'market-snapshot', version: 1 },
      ),
    );

    const pipelines = new Map<string, PipelineDefinition>();
    pipelines.set('market-snapshot@1', snapshotPipeline);
    registry = makeRegistry(pipelines);
  });

  it('creates prefixed step IDs from sub-pipeline nodes', () => {
    const result = expandCompositeNode(
      'snapshot',
      'market.snapshot',
      1,
      [
        { portName: 'item', source: 'pipeline-input', pipelineInputName: 'item' },
        { portName: 'region', source: 'pipeline-input', pipelineInputName: 'region' },
      ],
      catalog,
      registry,
      1,
    );

    expect(result.diagnostics).toHaveLength(0);
    expect(result.expandedSteps.length).toBe(2);

    const stepIds = result.expandedSteps.map((s) => s.id);
    expect(stepIds).toContain('snapshot/orders');
    expect(stepIds).toContain('snapshot/aggregate');
  });

  it('wires parent input bindings to sub-pipeline inputs', () => {
    const result = expandCompositeNode(
      'snapshot',
      'market.snapshot',
      1,
      [
        { portName: 'item', source: 'pipeline-input', pipelineInputName: 'item' },
        { portName: 'region', source: 'pipeline-input', pipelineInputName: 'region' },
      ],
      catalog,
      registry,
      1,
    );

    const ordersStep = result.expandedSteps.find((s) => s.id === 'snapshot/orders');
    expect(ordersStep).toBeDefined();
    expect(
      ordersStep!.inputs.some((i) => i.portName === 'item' && i.source === 'pipeline-input'),
    ).toBe(true);
    expect(
      ordersStep!.inputs.some((i) => i.portName === 'region' && i.source === 'pipeline-input'),
    ).toBe(true);
  });

  it('wires internal edges between sub-steps', () => {
    const result = expandCompositeNode(
      'snapshot',
      'market.snapshot',
      1,
      [
        { portName: 'item', source: 'pipeline-input', pipelineInputName: 'item' },
        { portName: 'region', source: 'pipeline-input', pipelineInputName: 'region' },
      ],
      catalog,
      registry,
      1,
    );

    const aggregateStep = result.expandedSteps.find((s) => s.id === 'snapshot/aggregate');
    expect(aggregateStep).toBeDefined();
    expect(
      aggregateStep!.inputs.some(
        (i) =>
          i.portName === 'orders' && i.source === 'step-output' && i.stepId === 'snapshot/orders',
      ),
    ).toBe(true);
  });

  it('rejects nesting beyond max depth', () => {
    const result = expandCompositeNode('deep', 'market.snapshot', 1, [], catalog, registry, 11);

    expect(result.diagnostics.some((d) => d.code === 'COMPOSITE_MAX_DEPTH')).toBe(true);
  });

  it('reports error for non-composite capability', () => {
    const result = expandCompositeNode('orders', 'market.orders', 1, [], catalog, registry, 1);

    expect(result.diagnostics.some((d) => d.code === 'COMPOSITE_NOT_COMPOSITE')).toBe(true);
  });
});
