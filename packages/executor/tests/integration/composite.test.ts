import { describe, it, expect } from 'vitest';
import {
  CapabilityCatalog,
  capabilityId,
  capabilityVersion,
  semanticTypeId,
} from '@eve-fabric/domain';
import type { PipelineDefinition } from '@eve-fabric/domain';
import { publishAsComposite } from '@eve-fabric/capability-sdk';
import { compile } from '@eve-fabric/compiler';
import { resolveComposites } from '@eve-fabric/compiler';
import type { PipelineRegistry } from '@eve-fabric/compiler';

describe('Composite capability integration', () => {
  function setupCatalogAndPipeline() {
    const catalog = new CapabilityCatalog();

    catalog.register({
      id: 'market.orders',
      version: 1,
      name: 'Market Orders',
      description: 'Fetch market orders',
      inputs: {
        item: { name: 'item', semanticType: 'eve.type.reference', required: true },
        region: { name: 'region', semanticType: 'eve.region.reference', required: true },
      },
      outputs: {
        orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
      },
      source: 'ESI',
      dependencies: [],
      auth: { required: false, scopes: [] },
      cache: {
        cacheable: true,
        defaultTtlSeconds: 300,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
    });

    catalog.register({
      id: 'market.aggregate',
      version: 1,
      name: 'Market Aggregate',
      description: 'Aggregate orders into pricing',
      inputs: {
        orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
      },
      outputs: {
        lowestSell: { name: 'lowestSell', semanticType: 'eve.currency.isk', required: true },
        highestBuy: { name: 'highestBuy', semanticType: 'eve.currency.isk', required: true },
      },
      source: 'DERIVED',
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

    return { catalog, snapshotPipeline };
  }

  it('publishes a pipeline as composite and registers it in the catalog', () => {
    const { catalog, snapshotPipeline } = setupCatalogAndPipeline();

    const result = publishAsComposite(snapshotPipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    expect(result.capability).toBeDefined();
    expect(result.capability.source).toBe('COMPOSITE');
    expect(result.capability.pipelineRef).toEqual({
      id: 'market-snapshot',
      version: 1,
    });

    expect(catalog.has(capabilityId('market.snapshot'))).toBe(true);
  });

  it('resolves composite nodes into expanded sub-graphs', () => {
    const { catalog, snapshotPipeline } = setupCatalogAndPipeline();

    publishAsComposite(snapshotPipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    const pipelines = new Map<string, PipelineDefinition>();
    pipelines.set('market-snapshot@1', snapshotPipeline);
    const registry: PipelineRegistry = {
      get(id: string, version: number) {
        return pipelines.get(`${id}@${version}`);
      },
    };

    const tradePipeline: PipelineDefinition = {
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

    const resolved = resolveComposites(tradePipeline, catalog, registry);
    expect(resolved.diagnostics).toHaveLength(0);

    const nodeIds = resolved.expandedPipeline.nodes.map((n) => n.id);
    expect(nodeIds).toContain('snapshot/orders');
    expect(nodeIds).toContain('snapshot/aggregate');
    expect(nodeIds).not.toContain('snapshot');
  });

  it('compiles the expanded pipeline successfully', () => {
    const { catalog, snapshotPipeline } = setupCatalogAndPipeline();

    publishAsComposite(snapshotPipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    const pipelines = new Map<string, PipelineDefinition>();
    pipelines.set('market-snapshot@1', snapshotPipeline);
    const registry: PipelineRegistry = {
      get(id: string, version: number) {
        return pipelines.get(`${id}@${version}`);
      },
    };

    const tradePipeline: PipelineDefinition = {
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

    const resolved = resolveComposites(tradePipeline, catalog, registry);
    const compileResult = compile(resolved.expandedPipeline, catalog);

    expect(compileResult.success).toBe(true);
    expect(compileResult.plan).toBeDefined();
    expect(compileResult.plan!.steps.length).toBeGreaterThanOrEqual(2);
  });
});
