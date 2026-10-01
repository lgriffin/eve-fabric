import { describe, it, expect } from 'vitest';
import { resolveDependencies } from '../src/resolve-dependencies.js';
import type { PipelineDefinition, CapabilityDefinition } from '@eve-fabric/core';

function makePipeline(overrides?: Partial<PipelineDefinition>): PipelineDefinition {
  return {
    id: 'test-pipeline',
    version: 1,
    name: 'Test Pipeline',
    inputs: [],
    nodes: [],
    edges: [],
    outputs: [{ name: 'result', source: 'fetch.orders' }],
    ...overrides,
  };
}

const emptyResolved = new Map<string, CapabilityDefinition>();

describe('resolveDependencies', () => {
  it('returns empty dependsOn for nodes with no edges', () => {
    const pipeline = makePipeline({
      nodes: [
        { id: 'A', capability: { id: 'market.orders' as any } },
        { id: 'B', capability: { id: 'price.aggregator' as any } },
      ],
      edges: [],
    });

    const result = resolveDependencies(pipeline, emptyResolved);

    expect(result).toHaveLength(2);
    expect(result.find((n) => n.nodeId === 'A')!.dependsOn).toHaveLength(0);
    expect(result.find((n) => n.nodeId === 'B')!.dependsOn).toHaveLength(0);
  });

  it('resolves linear chain A -> B -> C', () => {
    const pipeline = makePipeline({
      nodes: [
        { id: 'A', capability: { id: 'cap.a' as any } },
        { id: 'B', capability: { id: 'cap.b' as any } },
        { id: 'C', capability: { id: 'cap.c' as any } },
      ],
      edges: [
        { from: 'A.out', to: 'B.in' },
        { from: 'B.out', to: 'C.in' },
      ],
    });

    const result = resolveDependencies(pipeline, emptyResolved);

    expect(result.find((n) => n.nodeId === 'A')!.dependsOn).toHaveLength(0);
    expect(result.find((n) => n.nodeId === 'B')!.dependsOn).toContain('A');
    expect(result.find((n) => n.nodeId === 'C')!.dependsOn).toContain('B');
  });

  it('resolves diamond dependency (A->B, A->C, B->D, C->D)', () => {
    const pipeline = makePipeline({
      nodes: [
        { id: 'A', capability: { id: 'cap.a' as any } },
        { id: 'B', capability: { id: 'cap.b' as any } },
        { id: 'C', capability: { id: 'cap.c' as any } },
        { id: 'D', capability: { id: 'cap.d' as any } },
      ],
      edges: [
        { from: 'A.out', to: 'B.in' },
        { from: 'A.out', to: 'C.in' },
        { from: 'B.out', to: 'D.in' },
        { from: 'C.out', to: 'D.in2' },
      ],
    });

    const result = resolveDependencies(pipeline, emptyResolved);

    expect(result.find((n) => n.nodeId === 'A')!.dependsOn).toHaveLength(0);
    expect(result.find((n) => n.nodeId === 'B')!.dependsOn).toEqual(['A']);
    expect(result.find((n) => n.nodeId === 'C')!.dependsOn).toEqual(['A']);

    const dDeps = result.find((n) => n.nodeId === 'D')!.dependsOn;
    expect(dDeps).toHaveLength(2);
    expect(dDeps).toContain('B');
    expect(dDeps).toContain('C');
  });

  it('skips input.* and output.* pseudo-node references', () => {
    const pipeline = makePipeline({
      nodes: [{ id: 'fetch', capability: { id: 'market.orders' as any } }],
      edges: [
        { from: 'input.regionId', to: 'fetch.regionId' },
        { from: 'fetch.orders', to: 'output.result' },
      ],
    });

    const result = resolveDependencies(pipeline, emptyResolved);

    expect(result).toHaveLength(1);
    expect(result[0]!.nodeId).toBe('fetch');
    expect(result[0]!.dependsOn).toHaveLength(0);
  });

  it('returns empty array for empty pipeline', () => {
    const pipeline = makePipeline({ nodes: [], edges: [] });

    const result = resolveDependencies(pipeline, emptyResolved);

    expect(result).toHaveLength(0);
  });
});
