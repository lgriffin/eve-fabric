import { describe, it, expect } from 'vitest';
import { parsePortReference } from '../../src/pipeline/pipeline-edge.js';
import {
  pipelineInputSchema,
  pipelineOutputSchema,
  pipelineNodeSchema,
  pipelineEdgeSchema,
  pipelineDefinitionSchema,
} from '../../src/pipeline/schemas.js';

describe('parsePortReference', () => {
  it('parses pipeline input reference', () => {
    const ref = parsePortReference('input.regionId');
    expect(ref).toEqual({ source: 'input', port: 'regionId' });
  });

  it('parses node output reference', () => {
    const ref = parsePortReference('fetchOrders.orders');
    expect(ref).toEqual({ source: 'fetchOrders', port: 'orders' });
  });

  it('parses reference with hyphenated source', () => {
    const ref = parsePortReference('fetch-orders.orders');
    expect(ref).toEqual({ source: 'fetch-orders', port: 'orders' });
  });

  it('throws on missing dot separator', () => {
    expect(() => parsePortReference('noDot')).toThrow('Invalid port reference');
  });

  it('throws on empty string', () => {
    expect(() => parsePortReference('')).toThrow('Invalid port reference');
  });
});

describe('pipelineInputSchema', () => {
  it('accepts a valid input with all fields', () => {
    const result = pipelineInputSchema.safeParse({
      name: 'regionId',
      semanticType: 'eve.region.reference',
      description: 'The region to query',
      required: true,
    });
    expect(result.success).toBe(true);
  });

  it('defaults required to true', () => {
    const result = pipelineInputSchema.parse({
      name: 'regionId',
      semanticType: 'eve.region.reference',
    });
    expect(result.required).toBe(true);
  });

  it('accepts optional input', () => {
    const result = pipelineInputSchema.safeParse({
      name: 'limit',
      semanticType: 'eve.common.count',
      required: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid semantic type', () => {
    const result = pipelineInputSchema.safeParse({
      name: 'regionId',
      semanticType: 'INVALID',
      required: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = pipelineInputSchema.safeParse({
      name: '',
      semanticType: 'eve.region.reference',
      required: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('pipelineOutputSchema', () => {
  it('accepts a valid output', () => {
    const result = pipelineOutputSchema.safeParse({
      name: 'orders',
      source: 'fetchOrders.orders',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid source port reference', () => {
    const result = pipelineOutputSchema.safeParse({
      name: 'orders',
      source: 'noDot',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = pipelineOutputSchema.safeParse({
      name: '',
      source: 'fetchOrders.orders',
    });
    expect(result.success).toBe(false);
  });
});

describe('pipelineNodeSchema', () => {
  it('accepts a valid node', () => {
    const result = pipelineNodeSchema.safeParse({
      id: 'fetchOrders',
      capability: { id: 'market.orders' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts node with version and config', () => {
    const result = pipelineNodeSchema.safeParse({
      id: 'fetchOrders',
      capability: { id: 'market.orders', version: 2 },
      config: { limit: 100, orderType: 'buy' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty node id', () => {
    const result = pipelineNodeSchema.safeParse({
      id: '',
      capability: { id: 'market.orders' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid capability id', () => {
    const result = pipelineNodeSchema.safeParse({
      id: 'fetchOrders',
      capability: { id: 'INVALID' },
    });
    expect(result.success).toBe(false);
  });
});

describe('pipelineEdgeSchema', () => {
  it('accepts a valid edge', () => {
    const result = pipelineEdgeSchema.safeParse({
      from: 'input.regionId',
      to: 'fetchOrders.regionId',
    });
    expect(result.success).toBe(true);
  });

  it('accepts edge between nodes', () => {
    const result = pipelineEdgeSchema.safeParse({
      from: 'fetchOrders.orders',
      to: 'filterOrders.input',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid from reference', () => {
    const result = pipelineEdgeSchema.safeParse({
      from: 'noDot',
      to: 'fetchOrders.regionId',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid to reference', () => {
    const result = pipelineEdgeSchema.safeParse({
      from: 'input.regionId',
      to: 'noDot',
    });
    expect(result.success).toBe(false);
  });
});

function validPipeline(overrides: Record<string, unknown> = {}) {
  return {
    id: 'market-analysis',
    version: 1,
    name: 'Market Analysis Pipeline',
    description: 'Analyzes market data for a region',
    inputs: [
      {
        name: 'regionId',
        semanticType: 'eve.region.reference',
        required: true,
      },
    ],
    nodes: [
      {
        id: 'fetchOrders',
        capability: { id: 'market.orders', version: 1 },
      },
    ],
    edges: [
      {
        from: 'input.regionId',
        to: 'fetchOrders.regionId',
      },
    ],
    outputs: [
      {
        name: 'orders',
        source: 'fetchOrders.orders',
      },
    ],
    ...overrides,
  };
}

describe('pipelineDefinitionSchema', () => {
  it('accepts a valid pipeline definition', () => {
    const result = pipelineDefinitionSchema.safeParse(validPipeline());
    expect(result.success).toBe(true);
  });

  it('accepts pipeline without description', () => {
    const pipeline = validPipeline();
    delete (pipeline as Record<string, unknown>).description;
    const result = pipelineDefinitionSchema.safeParse(pipeline);
    expect(result.success).toBe(true);
  });

  it('defaults empty inputs and edges', () => {
    const pipeline = validPipeline();
    delete (pipeline as Record<string, unknown>).inputs;
    delete (pipeline as Record<string, unknown>).edges;
    const result = pipelineDefinitionSchema.parse(pipeline);
    expect(result.inputs).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('rejects missing name', () => {
    const pipeline = validPipeline();
    delete (pipeline as Record<string, unknown>).name;
    expect(pipelineDefinitionSchema.safeParse(pipeline).success).toBe(false);
  });

  it('rejects missing nodes', () => {
    expect(pipelineDefinitionSchema.safeParse(validPipeline({ nodes: [] })).success).toBe(false);
  });

  it('rejects empty outputs', () => {
    expect(pipelineDefinitionSchema.safeParse(validPipeline({ outputs: [] })).success).toBe(false);
  });

  it('rejects invalid pipeline id with uppercase', () => {
    expect(
      pipelineDefinitionSchema.safeParse(validPipeline({ id: 'MarketAnalysis' })).success,
    ).toBe(false);
  });

  it('rejects invalid pipeline id with dots', () => {
    expect(
      pipelineDefinitionSchema.safeParse(validPipeline({ id: 'market.analysis' })).success,
    ).toBe(false);
  });

  it('rejects zero version', () => {
    expect(pipelineDefinitionSchema.safeParse(validPipeline({ version: 0 })).success).toBe(false);
  });

  it('rejects non-integer version', () => {
    expect(pipelineDefinitionSchema.safeParse(validPipeline({ version: 1.5 })).success).toBe(false);
  });

  it('accepts multi-node pipeline', () => {
    const result = pipelineDefinitionSchema.safeParse(
      validPipeline({
        nodes: [
          { id: 'fetchOrders', capability: { id: 'market.orders' } },
          { id: 'filterOrders', capability: { id: 'market.filter' } },
        ],
        edges: [
          { from: 'input.regionId', to: 'fetchOrders.regionId' },
          { from: 'fetchOrders.orders', to: 'filterOrders.input' },
        ],
        outputs: [{ name: 'filtered', source: 'filterOrders.result' }],
      }),
    );
    expect(result.success).toBe(true);
  });
});
