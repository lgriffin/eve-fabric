import { describe, it, expect, beforeEach } from 'vitest';
import { validateSemanticWiring } from '../src/validate-semantic-wiring.js';
import { SEMANTIC_TYPE_MISMATCH, UNKNOWN_PORT, CAPABILITY_NOT_FOUND } from '../src/diagnostics.js';
import { CapabilityCatalog } from '@eve-fabric/core';
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

describe('validateSemanticWiring', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    catalog.register(marketOrdersDef());
    catalog.register(priceAggregatorDef());
  });

  it('returns no diagnostics for compatible wiring', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference', required: true }],
      nodes: [
        { id: 'fetchOrders', capability: { id: 'market.orders', version: 1 } },
        { id: 'aggregate', capability: { id: 'price.aggregator', version: 1 } },
      ],
      edges: [
        { from: 'input.regionId', to: 'fetchOrders.regionId' },
        { from: 'fetchOrders.orders', to: 'aggregate.orders' },
      ],
      outputs: [{ name: 'result', source: 'aggregate.price' }],
    };

    const diagnostics = validateSemanticWiring(pipeline, catalog);
    expect(diagnostics).toHaveLength(0);
  });

  it('detects incompatible semantic types', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference', required: true }],
      nodes: [
        { id: 'fetchOrders', capability: { id: 'market.orders', version: 1 } },
        { id: 'aggregate', capability: { id: 'price.aggregator', version: 1 } },
      ],
      edges: [
        // Wiring region reference (from input) directly to orders input (expects order collection)
        { from: 'input.regionId', to: 'aggregate.orders' },
      ],
      outputs: [{ name: 'result', source: 'aggregate.price' }],
    };

    const diagnostics = validateSemanticWiring(pipeline, catalog);
    const mismatches = diagnostics.filter((d) => d.code === SEMANTIC_TYPE_MISMATCH);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]!.context?.actualType).toBe('eve.region.reference');
    expect(mismatches[0]!.context?.expectedType).toBe('eve.market.order.collection');
  });

  it('reports capability not found for unknown capabilities', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference', required: true }],
      nodes: [{ id: 'unknown', capability: { id: 'nonexistent.capability', version: 1 } }],
      edges: [{ from: 'input.regionId', to: 'unknown.somePort' }],
      outputs: [],
    };

    const diagnostics = validateSemanticWiring(pipeline, catalog);
    const notFound = diagnostics.filter((d) => d.code === CAPABILITY_NOT_FOUND);
    expect(notFound).toHaveLength(1);
    expect(notFound[0]!.context?.capability).toBe('nonexistent.capability');
  });

  it('handles missing port reference gracefully (no crash)', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [{ id: 'fetchOrders', capability: { id: 'market.orders', version: 1 } }],
      edges: [
        // Reference to a non-existent pipeline input
        { from: 'input.nonExistent', to: 'fetchOrders.regionId' },
      ],
      outputs: [],
    };

    // Should not throw; unresolvable references are skipped
    const diagnostics = validateSemanticWiring(pipeline, catalog);
    // No mismatch because the from-type couldn't be resolved
    const mismatches = diagnostics.filter((d) => d.code === SEMANTIC_TYPE_MISMATCH);
    expect(mismatches).toHaveLength(0);
  });

  it('reports an edge or output naming a node or port that does not exist', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [{ name: 'regionId', semanticType: 'eve.region.reference', required: true }],
      nodes: [
        { id: 'fetchOrders', capability: { id: 'market.orders', version: 1 } },
        { id: 'aggregate', capability: { id: 'price.aggregator', version: 1 } },
      ],
      edges: [
        { from: 'input.regionId', to: 'fetchOrders.regionId' },
        { from: 'input.regionId', to: 'fetchOrders.nothing' },
        { from: 'fetchOrders.nothing', to: 'aggregate.orders' },
        { from: 'ghost.orders', to: 'aggregate.orders' },
      ],
      outputs: [{ name: 'result', source: 'aggregate.nothing' }],
    };
    const unknown = validateSemanticWiring(pipeline, catalog).filter(
      (d) => d.code === UNKNOWN_PORT,
    );
    expect(unknown.map((d) => d.message)).toEqual([
      '"fetchOrders.nothing" names nothing: "market.orders" has no input "nothing"',
      '"fetchOrders.nothing" names nothing: "market.orders" has no output "nothing"',
      '"ghost.orders" names nothing: the pipeline has no node "ghost"',
      '"aggregate.nothing" names nothing: "price.aggregator" has no output "nothing"',
    ]);
  });
});
