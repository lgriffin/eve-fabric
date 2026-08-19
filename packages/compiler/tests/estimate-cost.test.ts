import { describe, it, expect, beforeEach } from 'vitest';
import { estimateCost } from '../src/estimate-cost.js';
import { CapabilityCatalog } from '@eve-fabric/domain';
import type { PipelineDefinition } from '../src/pipeline-types.js';
import type { StepGroup } from '../src/execution-types.js';

function esiCapDef() {
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
    cache: {
      cacheable: true,
      defaultTtlSeconds: 86400,
      stalePermitted: true,
      identityInKey: false,
    },
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

describe('estimateCost', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    catalog.register(esiCapDef());
    catalog.register(sdeCapDef());
    catalog.register(derivedCapDef());
  });

  it('sums total latency across all nodes', () => {
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

    const groups: StepGroup[] = [
      { steps: ['fetch'], canParallelize: false },
      { steps: ['agg'], canParallelize: false },
    ];

    const cost = estimateCost(pipeline, catalog, groups);
    expect(cost.totalLatencyMs).toBe(250); // 200 + 50
    expect(cost.esiCallCount).toBe(1);
  });

  it('sums ESI call counts', () => {
    // Register another ESI capability
    catalog.register({
      id: 'character.wallet',
      version: 1,
      name: 'Character Wallet',
      description: 'Fetch wallet data',
      inputs: {
        characterId: {
          name: 'characterId',
          semanticType: 'eve.character.reference',
          required: true,
        },
      },
      outputs: {
        balance: { name: 'balance', semanticType: 'eve.currency.isk', required: true },
      },
      source: 'ESI' as const,
      dependencies: [],
      auth: { required: true, scopes: ['esi-wallet.read_character_wallet.v1'] },
      cache: {
        cacheable: true,
        defaultTtlSeconds: 120,
        stalePermitted: false,
        identityInKey: true,
      },
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

    const groups: StepGroup[] = [{ steps: ['fetch', 'wallet'], canParallelize: true }];

    const cost = estimateCost(pipeline, catalog, groups);
    expect(cost.esiCallCount).toBe(2);
  });

  it('computes parallel latency as max within groups, summed across groups', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } }, // 200ms
        { id: 'lookup', capability: { id: 'sde.types.lookup' as any } }, // 5ms
        { id: 'agg', capability: { id: 'price.aggregator' as any } }, // 50ms
      ],
      edges: [],
      outputs: [],
    };

    // fetch and lookup run in parallel (max = 200ms), then agg (50ms)
    const groups: StepGroup[] = [
      { steps: ['fetch', 'lookup'], canParallelize: true },
      { steps: ['agg'], canParallelize: false },
    ];

    const cost = estimateCost(pipeline, catalog, groups);
    expect(cost.totalLatencyMs).toBe(255); // 200 + 5 + 50
    expect(cost.parallelLatencyMs).toBe(250); // max(200,5) + 50
  });

  it('returns zero costs for empty pipeline', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [],
      edges: [],
      outputs: [],
    };

    const cost = estimateCost(pipeline, catalog, []);
    expect(cost.totalLatencyMs).toBe(0);
    expect(cost.esiCallCount).toBe(0);
    expect(cost.parallelLatencyMs).toBe(0);
  });

  it('sequential groups: parallel latency equals total latency', () => {
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

    // Each step in its own group (fully sequential)
    const groups: StepGroup[] = [
      { steps: ['fetch'], canParallelize: false },
      { steps: ['agg'], canParallelize: false },
    ];

    const cost = estimateCost(pipeline, catalog, groups);
    expect(cost.parallelLatencyMs).toBe(cost.totalLatencyMs);
  });
});
