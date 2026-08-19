import { describe, it, expect, beforeEach } from 'vitest';
import { publishAsComposite } from '../src/publish-composite.js';
import {
  CapabilityCatalog,
  capabilityId,
  capabilityVersion,
  semanticTypeId,
} from '@eve-fabric/domain';
import type { PipelineDefinition } from '@eve-fabric/domain';

describe('publishAsComposite', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
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
      auth: { required: true, scopes: ['esi-markets.structure_markets.v1'] },
      cache: {
        cacheable: true,
        defaultTtlSeconds: 300,
        stalePermitted: true,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
    });

    catalog.register({
      id: 'market.aggregate',
      version: 1,
      name: 'Market Aggregate',
      description: 'Aggregate market orders into pricing',
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
  });

  function makeSnapshotPipeline(): PipelineDefinition {
    return {
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
  }

  it('publishes a valid pipeline as a COMPOSITE capability', () => {
    const pipeline = makeSnapshotPipeline();
    const result = publishAsComposite(pipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    expect(result.capability).toBeDefined();
    expect(result.capability.source).toBe('COMPOSITE');
    expect(result.capability.id).toBe(capabilityId('market.snapshot'));
    expect(result.capability.version).toBe(capabilityVersion(1));
  });

  it('sets pipeline reference on the composite capability', () => {
    const pipeline = makeSnapshotPipeline();
    const result = publishAsComposite(pipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    expect(result.capability.pipelineRef).toBeDefined();
    expect(result.capability.pipelineRef!.id).toBe('market-snapshot');
    expect(result.capability.pipelineRef!.version).toBe(1);
  });

  it('extracts inputs from pipeline inputs', () => {
    const pipeline = makeSnapshotPipeline();
    const result = publishAsComposite(pipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    const inputs = result.capability.inputs;
    expect(inputs.size).toBe(2);
    expect(inputs.has('item')).toBe(true);
    expect(inputs.has('region')).toBe(true);
    expect(inputs.get('item')!.semanticType as string).toBe('eve.type.reference');
  });

  it('resolves output semantic types from capability definitions', () => {
    const pipeline = makeSnapshotPipeline();
    const result = publishAsComposite(pipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    const outputs = result.capability.outputs;
    expect(outputs.size).toBe(2);
    expect(outputs.has('lowestSell')).toBe(true);
    expect(outputs.has('highestBuy')).toBe(true);
    expect(outputs.get('lowestSell')!.semanticType as string).toBe('eve.currency.isk');
  });

  it('aggregates auth requirements from all nodes', () => {
    const pipeline = makeSnapshotPipeline();
    const result = publishAsComposite(pipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    expect(result.capability.auth.required).toBe(true);
    expect(result.capability.auth.scopes).toContain('esi-markets.structure_markets.v1');
  });

  it('aggregates cost from all nodes', () => {
    const pipeline = makeSnapshotPipeline();
    const result = publishAsComposite(pipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    expect(result.capability.cost.estimatedLatencyMs).toBe(250);
    expect(result.capability.cost.esiCallCount).toBe(1);
  });

  it('lists all node capabilities as dependencies', () => {
    const pipeline = makeSnapshotPipeline();
    const result = publishAsComposite(pipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    expect(result.capability.dependencies.length).toBe(2);
    const depIds = result.capability.dependencies.map((d) => d.id as string);
    expect(depIds).toContain('market.orders');
    expect(depIds).toContain('market.aggregate');
  });

  it('registers the composite capability in the catalog', () => {
    const pipeline = makeSnapshotPipeline();
    publishAsComposite(pipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    expect(catalog.has(capabilityId('market.snapshot'))).toBe(true);
    const retrieved = catalog.get(capabilityId('market.snapshot'));
    expect(retrieved.source).toBe('COMPOSITE');
  });

  it('aggregates cache policies with least cacheable wins', () => {
    const pipeline = makeSnapshotPipeline();
    const result = publishAsComposite(pipeline, catalog, {
      id: 'market.snapshot',
      version: 1,
      name: 'Market Snapshot',
      description: 'Aggregated market pricing',
    });

    // market.orders is cacheable, market.aggregate is not => not cacheable
    expect(result.capability.cache.cacheable).toBe(false);
    // market.orders TTL=300, market.aggregate TTL=0 => min is 0
    expect(result.capability.cache.defaultTtlSeconds).toBe(0);
    // market.orders stalePermitted=true, market.aggregate stalePermitted=false => false
    expect(result.capability.cache.stalePermitted).toBe(false);
  });

  it('throws for unresolvable capabilities', () => {
    const pipeline: PipelineDefinition = {
      id: 'partial',
      version: 1,
      name: 'Partial',
      inputs: [],
      nodes: [
        {
          id: 'good',
          capability: { id: capabilityId('market.orders'), version: capabilityVersion(1) },
        },
        { id: 'missing', capability: { id: capabilityId('nonexistent.cap') } },
      ],
      edges: [],
      outputs: [{ name: 'orders', source: 'good.orders' }],
    };

    expect(() =>
      publishAsComposite(pipeline, catalog, {
        id: 'market.partial',
        version: 1,
        name: 'Partial',
        description: 'Pipeline with missing capability',
      }),
    ).toThrow('nonexistent.cap');
  });

  it('propagates identityInKey when any component requires it', () => {
    catalog.register({
      id: 'identity.cap',
      version: 1,
      name: 'Identity Cap',
      description: 'Requires identity in cache key',
      inputs: {
        token: { name: 'token', semanticType: 'eve.auth.token', required: true },
      },
      outputs: {
        result: { name: 'result', semanticType: 'eve.currency.isk', required: true },
      },
      source: 'ESI',
      dependencies: [],
      auth: { required: true, scopes: ['esi-wallet.read_character_wallet.v1'] },
      cache: {
        cacheable: true,
        defaultTtlSeconds: 120,
        stalePermitted: false,
        identityInKey: true,
      },
      cost: { estimatedLatencyMs: 100, esiCallCount: 1 },
    });

    const pipeline: PipelineDefinition = {
      id: 'identity-pipeline',
      version: 1,
      name: 'Identity Pipeline',
      inputs: [{ name: 'token', semanticType: semanticTypeId('eve.auth.token'), required: true }],
      nodes: [
        {
          id: 'idcap',
          capability: { id: capabilityId('identity.cap'), version: capabilityVersion(1) },
        },
      ],
      edges: [{ from: 'input.token', to: 'idcap.token' }],
      outputs: [{ name: 'result', source: 'idcap.result' }],
    };

    const result = publishAsComposite(pipeline, catalog, {
      id: 'identity.composite',
      version: 1,
      name: 'Identity Composite',
      description: 'Composite requiring identity in key',
    });

    expect(result.capability.cache.identityInKey).toBe(true);
  });
});
