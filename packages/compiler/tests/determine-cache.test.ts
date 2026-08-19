import { describe, it, expect, beforeEach } from 'vitest';
import { determineCache } from '../src/determine-cache.js';
import { CapabilityCatalog } from '@eve-fabric/domain';
import type { PipelineDefinition } from '../src/pipeline-types.js';

function cacheableCapDef() {
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

function nonCacheableCapDef() {
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

function identityKeyCapDef() {
  return {
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
  };
}

describe('determineCache', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    catalog.register(cacheableCapDef());
    catalog.register(nonCacheableCapDef());
    catalog.register(identityKeyCapDef());
  });

  it('creates a CacheStrategy per node', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any } },
      ],
      edges: [],
      outputs: [],
    };

    const strategies = determineCache(pipeline, catalog);
    expect(strategies).toHaveLength(2);
  });

  it('maps cacheable capability to cacheable strategy', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
      ],
      edges: [],
      outputs: [],
    };

    const strategies = determineCache(pipeline, catalog);
    expect(strategies).toHaveLength(1);
    expect(strategies[0]!.stepId).toBe('fetch');
    expect(strategies[0]!.cacheable).toBe(true);
    expect(strategies[0]!.ttlSeconds).toBe(300);
    expect(strategies[0]!.identityInKey).toBe(false);
  });

  it('maps non-cacheable capability correctly', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'agg', capability: { id: 'price.aggregator' as any } },
      ],
      edges: [],
      outputs: [],
    };

    const strategies = determineCache(pipeline, catalog);
    expect(strategies).toHaveLength(1);
    expect(strategies[0]!.stepId).toBe('agg');
    expect(strategies[0]!.cacheable).toBe(false);
    expect(strategies[0]!.ttlSeconds).toBe(0);
  });

  it('captures identityInKey flag', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'wallet', capability: { id: 'character.wallet' as any } },
      ],
      edges: [],
      outputs: [],
    };

    const strategies = determineCache(pipeline, catalog);
    expect(strategies).toHaveLength(1);
    expect(strategies[0]!.identityInKey).toBe(true);
    expect(strategies[0]!.ttlSeconds).toBe(120);
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

    const strategies = determineCache(pipeline, catalog);
    expect(strategies).toHaveLength(0);
  });
});
