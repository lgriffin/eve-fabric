import { describe, it, expect, beforeEach } from 'vitest';
import { compile } from '../src/compile.js';
import { CapabilityCatalog } from '@eve-fabric/core';
import type { PipelineDefinition } from '../src/pipeline-types.js';

function marketOrdersDef() {
  return {
    id: 'market.orders',
    version: 1,
    name: 'Market Orders',
    description: 'Fetch market orders for a region',
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

function sdeTypeLookupDef() {
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

function walletCapDef() {
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

describe('compile', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    catalog.register(marketOrdersDef());
    catalog.register(priceAggregatorDef());
    catalog.register(sdeTypeLookupDef());
    catalog.register(walletCapDef());
  });

  it('successfully compiles a valid pipeline', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference' as any, required: true }],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any, version: 1 as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any, version: 1 as any } },
      ],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
        { from: 'fetch.orders', to: 'agg.orders' },
      ],
      outputs: [{ name: 'price', source: 'agg.price' }],
    };

    const result = compile(pipeline, catalog);
    expect(result.success).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.plan!.steps).toHaveLength(2);
    expect(result.plan!.pipelineRef.id).toBe('test.pipeline');
    expect(result.plan!.pipelineRef.version).toBe(1);
  });

  it('fails for empty pipeline (no nodes)', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [],
      edges: [],
      outputs: [{ name: 'result', source: 'some.output' }],
    };

    const result = compile(pipeline, catalog);
    expect(result.success).toBe(false);
    expect(result.plan).toBeUndefined();
    const emptyCodes = result.diagnostics.filter((d) => d.code === 'EMPTY_PIPELINE');
    expect(emptyCodes).toHaveLength(1);
  });

  it('fails for pipeline with no outputs', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [{ id: 'fetch', capability: { id: 'market.orders' as any } }],
      edges: [],
      outputs: [],
    };

    const result = compile(pipeline, catalog);
    expect(result.success).toBe(false);
    const noOutputCodes = result.diagnostics.filter((d) => d.code === 'NO_OUTPUTS');
    expect(noOutputCodes).toHaveLength(1);
  });

  it('fails when a capability is not found', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [{ id: 'missing', capability: { id: 'nonexistent.cap' as any } }],
      edges: [],
      outputs: [{ name: 'result', source: 'missing.output' }],
    };

    const result = compile(pipeline, catalog);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'CAPABILITY_NOT_FOUND')).toBe(true);
  });

  it('fails when a cycle is detected', () => {
    // Register a capability that can create a cycle scenario
    catalog.register({
      id: 'transform.cycle',
      version: 1,
      name: 'Cyclic Transform',
      description: 'For testing cycles',
      inputs: {
        input: { name: 'input', semanticType: 'eve.market.order.collection', required: true },
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
      cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
    });

    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'A', capability: { id: 'transform.cycle' as any } },
        { id: 'B', capability: { id: 'transform.cycle' as any } },
      ],
      edges: [
        { from: 'A.output', to: 'B.input' },
        { from: 'B.output', to: 'A.input' },
      ],
      outputs: [{ name: 'result', source: 'A.output' }],
    };

    const result = compile(pipeline, catalog);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'GRAPH_CYCLE_DETECTED')).toBe(true);
  });

  it('produces an execution plan with source requirements', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference' as any, required: true }],
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

    const result = compile(pipeline, catalog);
    expect(result.success).toBe(true);
    expect(result.plan!.sourceRequirements.length).toBeGreaterThanOrEqual(1);
    const esiSource = result.plan!.sourceRequirements.find((s) => s.source === 'ESI');
    expect(esiSource).toBeDefined();
  });

  it('produces an execution plan with auth requirements', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [
        { name: 'characterId', semanticType: 'eve.character.reference' as any, required: true },
      ],
      nodes: [{ id: 'wallet', capability: { id: 'character.wallet' as any } }],
      edges: [{ from: 'input.characterId', to: 'wallet.characterId' }],
      outputs: [{ name: 'balance', source: 'wallet.balance' }],
    };

    const result = compile(pipeline, catalog);
    expect(result.success).toBe(true);
    expect(result.plan!.authRequirements.required).toBe(true);
    expect(result.plan!.authRequirements.scopes).toContain('esi-wallet.read_character_wallet.v1');
  });

  it('produces an execution plan with cache strategies', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference' as any, required: true }],
      nodes: [{ id: 'fetch', capability: { id: 'market.orders' as any } }],
      edges: [{ from: 'input.regionId', to: 'fetch.regionId' }],
      outputs: [{ name: 'orders', source: 'fetch.orders' }],
    };

    const result = compile(pipeline, catalog);
    expect(result.success).toBe(true);
    expect(result.plan!.cacheStrategy).toHaveLength(1);
    expect(result.plan!.cacheStrategy[0]!.stepId).toBe('fetch');
    expect(result.plan!.cacheStrategy[0]!.cacheable).toBe(true);
    expect(result.plan!.cacheStrategy[0]!.ttlSeconds).toBe(300);
  });

  it('produces an execution plan with cost estimate', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference' as any, required: true }],
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

    const result = compile(pipeline, catalog);
    expect(result.success).toBe(true);
    expect(result.plan!.costEstimate.totalLatencyMs).toBe(250);
    expect(result.plan!.costEstimate.esiCallCount).toBe(1);
    expect(result.plan!.costEstimate.parallelLatencyMs).toBe(250); // sequential
  });

  it('produces parallel groups for independent nodes', () => {
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

    const result = compile(pipeline, catalog);
    expect(result.success).toBe(true);
    // Both steps have no inter-step dependencies so they should be in one parallel group
    expect(result.plan!.parallelGroups).toHaveLength(1);
    expect(result.plan!.parallelGroups[0]!.canParallelize).toBe(true);
    // Parallel latency should be max of the two (200ms)
    expect(result.plan!.costEstimate.parallelLatencyMs).toBe(200);
  });

  it('returns diagnostics alongside a successful plan for info-level issues', () => {
    // Register a bridging capability
    catalog.register({
      id: 'transform.region.to.orders',
      version: 1,
      name: 'Region to Orders Transform',
      description: 'Transforms a region reference into market order collection',
      inputs: {
        region: { name: 'region', semanticType: 'eve.region.reference', required: true },
      },
      outputs: {
        orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
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

    // A pipeline with a type mismatch (wiring region ref directly to orders input)
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference' as any, required: true }],
      nodes: [{ id: 'agg', capability: { id: 'price.aggregator' as any } }],
      edges: [{ from: 'input.regionId', to: 'agg.orders' }],
      outputs: [{ name: 'price', source: 'agg.price' }],
    };

    const result = compile(pipeline, catalog);
    // Should fail because of type mismatch
    expect(result.success).toBe(false);
    // Should include both the mismatch error and a suggestion
    expect(result.diagnostics.some((d) => d.code === 'SEMANTIC_TYPE_MISMATCH')).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'SEMANTIC_SUGGESTION')).toBe(true);
  });

  it('compiles successfully when configuredInputs satisfy required ports', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [
        { name: 'fetch_regionId', semanticType: 'eve.region.reference' as any, required: false },
      ],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any } },
      ],
      edges: [
        { from: 'input.fetch_regionId', to: 'fetch.regionId' },
        { from: 'fetch.orders', to: 'agg.orders' },
      ],
      outputs: [{ name: 'price', source: 'agg.price' }],
    };

    const result = compile(pipeline, catalog, {
      configuredInputs: { fetch: { regionId: 10000002 } },
    });
    expect(result.success).toBe(true);
    expect(result.plan).toBeDefined();
  });

  it('fails when synthetic input edges have mismatched semantic types', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'fetch_regionId', semanticType: '' as any, required: false }],
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any } },
      ],
      edges: [
        { from: 'input.fetch_regionId', to: 'fetch.regionId' },
        { from: 'fetch.orders', to: 'agg.orders' },
      ],
      outputs: [{ name: 'price', source: 'agg.price' }],
    };

    const result = compile(pipeline, catalog, {
      configuredInputs: { fetch: { regionId: 10000002 } },
    });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'SEMANTIC_TYPE_MISMATCH')).toBe(true);
  });

  it('sets createdAt on the plan', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference' as any, required: true }],
      nodes: [{ id: 'fetch', capability: { id: 'market.orders' as any } }],
      edges: [{ from: 'input.regionId', to: 'fetch.regionId' }],
      outputs: [{ name: 'orders', source: 'fetch.orders' }],
    };

    const before = new Date();
    const result = compile(pipeline, catalog);
    const after = new Date();

    expect(result.success).toBe(true);
    expect(result.plan!.createdAt).toBeInstanceOf(Date);
    expect(result.plan!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.plan!.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
