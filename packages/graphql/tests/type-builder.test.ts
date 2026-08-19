import { describe, it, expect } from 'vitest';
import { GraphQLString, isNonNullType, isListType } from 'graphql';
import { buildOutputType } from '../src/type-builder.js';
import { CapabilityCatalog, capabilityId, capabilityVersion } from '@eve-fabric/domain';
import type { PipelineDefinition } from '@eve-fabric/domain';

function makeCapDef(overrides: {
  id: string;
  outputs: Record<string, { semanticType: string; required: boolean; description?: string }>;
  inputs?: Record<string, { semanticType: string; required: boolean }>;
}) {
  return {
    id: overrides.id,
    version: 1,
    name: overrides.id,
    description: `Capability ${overrides.id}`,
    inputs: overrides.inputs ?? {},
    outputs: Object.fromEntries(
      Object.entries(overrides.outputs).map(([k, v]) => [
        k,
        { name: k, semanticType: v.semanticType, required: v.required, description: v.description },
      ]),
    ),
    source: 'ESI',
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 100, esiCallCount: 1 },
  };
}

function makePipeline(
  name: string,
  outputs: Array<{ name: string; source: string }>,
  nodes: Array<{ id: string; capId: string }>,
): PipelineDefinition {
  return {
    id: 'test-pipeline',
    version: 1,
    name,
    inputs: [],
    nodes: nodes.map((n) => ({
      id: n.id,
      capability: { id: capabilityId(n.capId), version: capabilityVersion(1) },
    })),
    edges: [],
    outputs,
  };
}

describe('buildOutputType', () => {
  it('creates an object type with the pipeline name in PascalCase', () => {
    const catalog = new CapabilityCatalog();
    catalog.register(
      makeCapDef({
        id: 'market.orders',
        outputs: { price: { semanticType: 'eve.currency.isk', required: true } },
      }),
    );

    const pipeline = makePipeline(
      'Trade Opportunity',
      [{ name: 'bestPrice', source: 'fetch.price' }],
      [{ id: 'fetch', capId: 'market.orders' }],
    );

    const type = buildOutputType({ pipeline, catalog });

    expect(type.name).toBe('TradeOpportunity');
  });

  it('maps known semantic types to custom scalars', () => {
    const catalog = new CapabilityCatalog();
    catalog.register(
      makeCapDef({
        id: 'market.orders',
        outputs: { price: { semanticType: 'eve.currency.isk', required: true } },
      }),
    );

    const pipeline = makePipeline(
      'Price Check',
      [{ name: 'price', source: 'fetch.price' }],
      [{ id: 'fetch', capId: 'market.orders' }],
    );

    const type = buildOutputType({ pipeline, catalog });
    const fields = type.getFields();

    expect(fields['price']).toBeDefined();
    const priceField = fields['price']!;
    // Required field -> NonNull wrapper
    expect(isNonNullType(priceField.type)).toBe(true);
    if (isNonNullType(priceField.type)) {
      expect(priceField.type.ofType.toString()).toBe('ISK');
    }
  });

  it('wraps required fields in GraphQLNonNull', () => {
    const catalog = new CapabilityCatalog();
    catalog.register(
      makeCapDef({
        id: 'market.orders',
        outputs: {
          price: { semanticType: 'eve.currency.isk', required: true },
          note: { semanticType: 'eve.timestamp', required: false },
        },
      }),
    );

    const pipeline = makePipeline(
      'Price Check',
      [
        { name: 'price', source: 'fetch.price' },
        { name: 'note', source: 'fetch.note' },
      ],
      [{ id: 'fetch', capId: 'market.orders' }],
    );

    const type = buildOutputType({ pipeline, catalog });
    const fields = type.getFields();

    expect(isNonNullType(fields['price']!.type)).toBe(true);
    expect(isNonNullType(fields['note']!.type)).toBe(false);
  });

  it('falls back to GraphQLString for unknown semantic types', () => {
    const catalog = new CapabilityCatalog();
    catalog.register(
      makeCapDef({
        id: 'market.orders',
        outputs: { data: { semanticType: 'some.unknown.type', required: false } },
      }),
    );

    const pipeline = makePipeline(
      'Unknown Test',
      [{ name: 'data', source: 'fetch.data' }],
      [{ id: 'fetch', capId: 'market.orders' }],
    );

    const type = buildOutputType({ pipeline, catalog });
    const fields = type.getFields();

    expect(fields['data']!.type).toBe(GraphQLString);
  });

  it('handles collection types as lists', () => {
    const catalog = new CapabilityCatalog();
    catalog.register(
      makeCapDef({
        id: 'market.orders',
        outputs: {
          orders: { semanticType: 'eve.market.order.collection', required: true },
        },
      }),
    );

    const pipeline = makePipeline(
      'Order List',
      [{ name: 'orders', source: 'fetch.orders' }],
      [{ id: 'fetch', capId: 'market.orders' }],
    );

    const type = buildOutputType({ pipeline, catalog });
    const fields = type.getFields();
    const ordersField = fields['orders']!;

    // Required -> NonNull(List(...))
    expect(isNonNullType(ordersField.type)).toBe(true);
    if (isNonNullType(ordersField.type)) {
      expect(isListType(ordersField.type.ofType)).toBe(true);
    }
  });

  it('adds _empty field when no outputs can be resolved', () => {
    const catalog = new CapabilityCatalog();

    const pipeline = makePipeline('Empty Pipeline', [{ name: 'out', source: 'missing.field' }], []);

    const type = buildOutputType({ pipeline, catalog });
    const fields = type.getFields();

    expect(fields['_empty']).toBeDefined();
  });
});
