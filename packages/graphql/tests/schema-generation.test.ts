import { describe, it, expect } from 'vitest';
import { graphql, printSchema, GraphQLError } from 'graphql';
import {
  buildSchema,
  buildOutputType,
  buildInputType,
  getScalarForSemanticType,
  SEMANTIC_SCALARS,
  mapErrorToGraphQL,
  analyzeSelectionSet,
} from '../src/index.js';
import type { PipelineDefinition, SemanticPort } from '@eve-fabric/core';
import {
  CapabilityCatalog,
  capabilityId,
  capabilityVersion,
  semanticTypeId,
  SourceUnavailableError,
} from '@eve-fabric/core';

function makePort(semanticType: string, required = true): SemanticPort {
  return {
    name: 'test',
    semanticType: semanticTypeId(semanticType),
    required,
  };
}

function makeCatalog(capabilities: Record<string, unknown>[]): CapabilityCatalog {
  const catalog = new CapabilityCatalog();
  for (const cap of capabilities) {
    catalog.register(cap);
  }
  return catalog;
}

function makeCapabilityRecord(
  id: string,
  inputs: Record<string, SemanticPort>,
  outputs: Record<string, SemanticPort>,
): Record<string, unknown> {
  return {
    id,
    version: 1,
    name: id,
    description: `Capability ${id}`,
    inputs,
    outputs,
    source: 'ESI',
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 100, esiCallCount: 1 },
  };
}

function makePipeline(overrides: Partial<PipelineDefinition> = {}): PipelineDefinition {
  return {
    id: 'test-pipeline',
    version: 1,
    name: overrides.name ?? 'Test Pipeline',
    description: overrides.description ?? 'A test pipeline',
    inputs: overrides.inputs ?? [],
    nodes: overrides.nodes ?? [],
    edges: overrides.edges ?? [],
    outputs: overrides.outputs ?? [],
  };
}

describe('scalars', () => {
  it('maps eve.currency.isk to ISK scalar', () => {
    const scalar = getScalarForSemanticType('eve.currency.isk');
    expect(scalar).toBeDefined();
    expect(scalar!.name).toBe('ISK');
  });

  it('maps eve.type.reference to TypeReference scalar', () => {
    const scalar = getScalarForSemanticType('eve.type.reference');
    expect(scalar).toBeDefined();
    expect(scalar!.name).toBe('TypeReference');
  });

  it('maps eve.region.reference to RegionReference scalar', () => {
    const scalar = getScalarForSemanticType('eve.region.reference');
    expect(scalar!.name).toBe('RegionReference');
  });

  it('maps eve.timestamp to DateTime scalar', () => {
    const scalar = getScalarForSemanticType('eve.timestamp');
    expect(scalar!.name).toBe('DateTime');
  });

  it('returns undefined for unknown type', () => {
    expect(getScalarForSemanticType('unknown.type')).toBeUndefined();
  });

  it('contains all 8 semantic scalars', () => {
    expect(SEMANTIC_SCALARS.size).toBe(8);
  });
});

describe('buildOutputType', () => {
  it('generates output type from pipeline outputs', () => {
    const cap = makeCapabilityRecord(
      'market.aggregate',
      { orders: makePort('eve.market.order.collection') },
      {
        lowestSell: makePort('eve.currency.isk'),
        highestBuy: makePort('eve.currency.isk'),
      },
    );
    const catalog = makeCatalog([cap]);
    const pipeline = makePipeline({
      nodes: [
        {
          id: 'agg',
          capability: { id: capabilityId('market.aggregate'), version: capabilityVersion(1) },
        },
      ],
      outputs: [
        { name: 'sellPrice', source: 'agg.lowestSell' },
        { name: 'buyPrice', source: 'agg.highestBuy' },
      ],
    });

    const type = buildOutputType({ pipeline, catalog });

    expect(type.name).toBe('TestPipeline');
    const fields = type.getFields();
    expect(fields['sellPrice']).toBeDefined();
    expect(fields['buyPrice']).toBeDefined();
  });

  it('uses PascalCase for type name from pipeline name', () => {
    const cap = makeCapabilityRecord(
      'market.aggregate',
      {},
      { result: makePort('eve.currency.isk') },
    );
    const catalog = makeCatalog([cap]);
    const pipeline = makePipeline({
      name: 'Trade Opportunity',
      nodes: [
        {
          id: 'agg',
          capability: { id: capabilityId('market.aggregate'), version: capabilityVersion(1) },
        },
      ],
      outputs: [{ name: 'price', source: 'agg.result' }],
    });

    const type = buildOutputType({ pipeline, catalog });
    expect(type.name).toBe('TradeOpportunity');
  });
});

describe('buildInputType', () => {
  it('generates input type from pipeline inputs', () => {
    const catalog = makeCatalog([]);
    const pipeline = makePipeline({
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
        { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
      ],
    });

    const inputType = buildInputType({ pipeline, catalog });

    expect(inputType.name).toBe('TestPipelineInput');
    const fields = inputType.getFields();
    expect(fields['item']).toBeDefined();
    expect(fields['region']).toBeDefined();
  });

  it('makes required inputs non-null', () => {
    const catalog = makeCatalog([]);
    const pipeline = makePipeline({
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
        { name: 'maxJumps', semanticType: semanticTypeId('eve.route.distance'), required: false },
      ],
    });

    const inputType = buildInputType({ pipeline, catalog });
    const fields = inputType.getFields();

    expect(fields['item']!.type.toString()).toBe('TypeReference!');
    expect(fields['maxJumps']!.type.toString()).toBe('RouteDistance');
  });
});

describe('buildSchema', () => {
  it('builds a complete GraphQL schema from pipeline registrations', () => {
    const cap = makeCapabilityRecord(
      'market.aggregate',
      { orders: makePort('eve.market.order.collection') },
      { lowestSell: makePort('eve.currency.isk') },
    );
    const catalog = makeCatalog([cap]);
    const pipeline = makePipeline({
      name: 'Market Snapshot',
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
      ],
      nodes: [
        {
          id: 'agg',
          capability: { id: capabilityId('market.aggregate'), version: capabilityVersion(1) },
        },
      ],
      outputs: [{ name: 'lowestSell', source: 'agg.lowestSell' }],
    });

    const schema = buildSchema([{ pipeline, catalog }]);

    const sdl = printSchema(schema);
    expect(sdl).toContain('type Query');
    expect(sdl).toContain('marketSnapshot');
    expect(sdl).toContain('MarketSnapshotInput');
    expect(sdl).toContain('ISK');
  });

  it('generates camelCase query field names', () => {
    const cap = makeCapabilityRecord(
      'market.aggregate',
      {},
      { result: makePort('eve.currency.isk') },
    );
    const catalog = makeCatalog([cap]);
    const pipeline = makePipeline({
      name: 'Trade Opportunity',
      nodes: [
        {
          id: 'agg',
          capability: { id: capabilityId('market.aggregate'), version: capabilityVersion(1) },
        },
      ],
      outputs: [{ name: 'price', source: 'agg.result' }],
    });

    const schema = buildSchema([{ pipeline, catalog }]);
    const sdl = printSchema(schema);
    expect(sdl).toContain('tradeOpportunity');
  });
});

describe('error mapper', () => {
  it('maps GatewayError to GraphQL error with extensions', () => {
    const err = new SourceUnavailableError({
      source: 'ESI',
      capabilityId: 'market.orders',
      endpoint: '/markets/prices',
    });

    const graphqlError = mapErrorToGraphQL(err);

    expect(graphqlError.message).toContain('market.orders');
    expect(graphqlError.extensions).toBeDefined();
    expect(graphqlError.extensions!['code']).toBe('GATEWAY_SOURCE_UNAVAILABLE');
    expect(graphqlError.extensions!['category']).toBe('runtime');
  });

  it('strips infrastructure details from unknown errors', () => {
    const err = new Error('Connection refused at 192.168.1.1:5432');

    const graphqlError = mapErrorToGraphQL(err);

    expect(graphqlError.message).toBe('Internal server error');
    expect(graphqlError.extensions!['code']).toBe('INTERNAL_ERROR');
  });

  it('passes through GraphQL errors unchanged', () => {
    const original = new GraphQLError('Custom error', {
      extensions: { code: 'CUSTOM' },
    });

    const mapped = mapErrorToGraphQL(original);
    expect(mapped.message).toBe('Custom error');
  });
});

describe('selection analyzer', () => {
  it('extracts top-level field names from resolve info', () => {
    const mockInfo = {
      fieldNodes: [
        {
          selectionSet: {
            selections: [
              { kind: 'Field', name: { value: 'price' } },
              { kind: 'Field', name: { value: 'item' } },
            ],
          },
        },
      ],
    };

    const fields = analyzeSelectionSet(mockInfo as never);
    expect(fields.has('price')).toBe(true);
    expect(fields.has('item')).toBe(true);
    expect(fields.size).toBe(2);
  });

  it('returns empty set when no selection set', () => {
    const mockInfo = {
      fieldNodes: [{}],
    };

    const fields = analyzeSelectionSet(mockInfo as never);
    expect(fields.size).toBe(0);
  });
});

describe('schema with executor', () => {
  it('resolves queries through executor when provided', async () => {
    const cap = makeCapabilityRecord(
      'market.aggregate',
      { item: makePort('eve.type.reference') },
      { lowestSell: makePort('eve.currency.isk') },
    );
    const catalog = makeCatalog([cap]);
    const pipeline = makePipeline({
      name: 'Market Snapshot',
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
      ],
      nodes: [
        {
          id: 'agg',
          capability: { id: capabilityId('market.aggregate'), version: capabilityVersion(1) },
        },
      ],
      outputs: [{ name: 'lowestSell', source: 'agg.lowestSell' }],
    });

    const mockExecutor = {
      execute: async () => ({
        outputs: new Map([['agg', { lowestSell: 42.5, highestBuy: 40 }]]),
        provenance: new Map(),
      }),
    };

    const mockPlan = {
      id: 'test-plan',
      pipelineRef: { id: 'test', version: 1 },
      steps: [],
      parallelGroups: [],
      sourceRequirements: [],
      authRequirements: { required: false, scopes: [] },
      cacheStrategy: [],
      costEstimate: { totalLatencyMs: 100, esiCallCount: 1, parallelLatencyMs: 100 },
      createdAt: new Date(),
    };

    const schema = buildSchema([
      {
        pipeline,
        catalog,
        plan: mockPlan,
        executor: mockExecutor,
      },
    ]);

    const result = await graphql({
      schema,
      source: '{ marketSnapshot(input: { item: 34 }) { lowestSell } }',
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ marketSnapshot: { lowestSell: 42.5 } });
  });
});
