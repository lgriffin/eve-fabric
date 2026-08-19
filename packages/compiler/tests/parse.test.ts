import { describe, it, expect } from 'vitest';
import { parsePipeline } from '../src/parse.js';
import type { PipelineDefinition } from '@eve-fabric/domain';

function makePipeline(overrides?: Partial<PipelineDefinition>): PipelineDefinition {
  return {
    id: 'test-pipeline',
    version: 1,
    name: 'Test Pipeline',
    inputs: [],
    nodes: [{ id: 'fetch', capability: { id: 'market.orders' as any, version: 1 as any } }],
    edges: [],
    outputs: [{ name: 'result', source: 'fetch.orders' }],
    ...overrides,
  };
}

describe('parsePipeline', () => {
  it('returns EMPTY_PIPELINE diagnostic for 0 nodes', () => {
    const pipeline = makePipeline({ nodes: [] });

    const result = parsePipeline(pipeline);

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.code).toBe('EMPTY_PIPELINE');
    expect(result.diagnostics[0]!.severity).toBe('error');
  });

  it('returns no diagnostics for a valid pipeline with nodes and no edges', () => {
    const pipeline = makePipeline({
      nodes: [
        { id: 'fetch', capability: { id: 'market.orders' as any, version: 1 as any } },
        { id: 'agg', capability: { id: 'price.aggregator' as any, version: 1 as any } },
      ],
      edges: [],
    });

    const result = parsePipeline(pipeline);

    expect(result.diagnostics).toHaveLength(0);
  });

  it('returns UNKNOWN_NODE_REF when edge from references unknown node', () => {
    const pipeline = makePipeline({
      nodes: [{ id: 'fetch', capability: { id: 'market.orders' as any } }],
      edges: [{ from: 'nonexistent.output', to: 'fetch.input' }],
    });

    const result = parsePipeline(pipeline);

    const unknownRefs = result.diagnostics.filter((d) => d.code === 'UNKNOWN_NODE_REF');
    expect(unknownRefs).toHaveLength(1);
    expect(unknownRefs[0]!.message).toContain('nonexistent');
  });

  it('returns UNKNOWN_NODE_REF when edge to references unknown node', () => {
    const pipeline = makePipeline({
      nodes: [{ id: 'fetch', capability: { id: 'market.orders' as any } }],
      edges: [{ from: 'fetch.output', to: 'ghost.input' }],
    });

    const result = parsePipeline(pipeline);

    const unknownRefs = result.diagnostics.filter((d) => d.code === 'UNKNOWN_NODE_REF');
    expect(unknownRefs).toHaveLength(1);
    expect(unknownRefs[0]!.message).toContain('ghost');
  });

  it('does not flag input.* or output.* as unknown nodes', () => {
    const pipeline = makePipeline({
      nodes: [{ id: 'fetch', capability: { id: 'market.orders' as any } }],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
        { from: 'fetch.orders', to: 'output.result' },
      ],
    });

    const result = parsePipeline(pipeline);

    expect(result.diagnostics).toHaveLength(0);
  });

  it('returns the pipeline unchanged in the result', () => {
    const pipeline = makePipeline();

    const result = parsePipeline(pipeline);

    expect(result.pipeline).toBe(pipeline);
  });
});
