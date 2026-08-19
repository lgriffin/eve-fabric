import { describe, it, expect, beforeEach } from 'vitest';
import { determineSources } from '../src/determine-sources.js';
import { CapabilityCatalog } from '@eve-fabric/domain';
import type { PipelineDefinition } from '../src/pipeline-types.js';

function esiCapDef() {
  return {
    id: 'market.orders',
    version: 1,
    name: 'Market Orders',
    description: 'Fetch market orders from ESI',
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

function sdeCapDef() {
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

function derivedCapDef() {
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

describe('determineSources', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    catalog.register(esiCapDef());
    catalog.register(sdeCapDef());
    catalog.register(derivedCapDef());
  });

  it('groups capabilities by source type', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
        { id: 'lookup', capability: { id: 'sde.types.lookup' as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any } },
      ],
      edges: [],
      outputs: [],
    };

    const sources = determineSources(pipeline, catalog);
    expect(sources).toHaveLength(3);

    const esi = sources.find((s) => s.source === 'ESI');
    expect(esi).toBeDefined();
    expect(esi!.capabilities).toHaveLength(1);
    expect(esi!.capabilities[0]!.id).toBe('market.orders');

    const sde = sources.find((s) => s.source === 'SDE');
    expect(sde).toBeDefined();
    expect(sde!.capabilities).toHaveLength(1);

    const derived = sources.find((s) => s.source === 'DERIVED');
    expect(derived).toBeDefined();
    expect(derived!.capabilities).toHaveLength(1);
  });

  it('groups multiple capabilities with the same source', () => {
    // Register a second ESI capability
    catalog.register({
      id: 'character.wallet',
      version: 1,
      name: 'Character Wallet',
      description: 'Fetch wallet data',
      inputs: {
        characterId: { name: 'characterId', semanticType: 'eve.character.reference', required: true },
      },
      outputs: {
        balance: { name: 'balance', semanticType: 'eve.currency.isk', required: true },
      },
      source: 'ESI' as const,
      dependencies: [],
      auth: { required: true, scopes: ['esi-wallet.read_character_wallet.v1'] },
      cache: { cacheable: true, defaultTtlSeconds: 120, stalePermitted: false, identityInKey: true },
      cost: { estimatedLatencyMs: 150, esiCallCount: 1 },
    });

    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
        { id: 'wallet', capability: { id: 'character.wallet' as any } },
      ],
      edges: [],
      outputs: [],
    };

    const sources = determineSources(pipeline, catalog);
    const esi = sources.find((s) => s.source === 'ESI');
    expect(esi).toBeDefined();
    expect(esi!.capabilities).toHaveLength(2);
  });

  it('returns empty array for empty pipeline', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [],
      edges: [],
      outputs: [],
    };

    const sources = determineSources(pipeline, catalog);
    expect(sources).toHaveLength(0);
  });

  it('skips unresolvable capabilities', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'missing', capability: { id: 'nonexistent.cap' as any } },
        { id: 'fetch', capability: { id: 'market.orders' as any } },
      ],
      edges: [],
      outputs: [],
    };

    const sources = determineSources(pipeline, catalog);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.source).toBe('ESI');
  });
});
