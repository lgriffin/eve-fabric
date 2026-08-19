import { describe, it, expect } from 'vitest';
import { detectCycles } from '../src/detect-cycles.js';
import { GRAPH_CYCLE_DETECTED } from '../src/diagnostics.js';
import type { PipelineDefinition } from '../src/pipeline-types.js';

function makePipeline(
  nodes: PipelineDefinition['nodes'],
  edges: PipelineDefinition['edges'],
): PipelineDefinition {
  return {
    id: 'test.pipeline',
    version: 1,
    name: 'Test Pipeline',
    inputs: [],
    nodes,
    edges,
    outputs: [],
  };
}

describe('detectCycles', () => {
  it('returns no diagnostics for an acyclic pipeline', () => {
    const pipeline = makePipeline(
      [
        { id: 'A', capability: { id: 'cap.one' } },
        { id: 'B', capability: { id: 'cap.two' } },
        { id: 'C', capability: { id: 'cap.three' } },
      ],
      [
        { from: 'A.output', to: 'B.input' },
        { from: 'B.output', to: 'C.input' },
      ],
    );

    const diagnostics = detectCycles(pipeline);
    expect(diagnostics).toHaveLength(0);
  });

  it('detects a simple cycle between two nodes', () => {
    const pipeline = makePipeline(
      [
        { id: 'A', capability: { id: 'cap.one' } },
        { id: 'B', capability: { id: 'cap.two' } },
      ],
      [
        { from: 'A.output', to: 'B.input' },
        { from: 'B.output', to: 'A.input' },
      ],
    );

    const diagnostics = detectCycles(pipeline);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe(GRAPH_CYCLE_DETECTED);
    expect(diagnostics[0]!.message).toContain('A');
    expect(diagnostics[0]!.message).toContain('B');
  });

  it('detects a cycle in a three-node ring', () => {
    const pipeline = makePipeline(
      [
        { id: 'A', capability: { id: 'cap.one' } },
        { id: 'B', capability: { id: 'cap.two' } },
        { id: 'C', capability: { id: 'cap.three' } },
      ],
      [
        { from: 'A.output', to: 'B.input' },
        { from: 'B.output', to: 'C.input' },
        { from: 'C.output', to: 'A.input' },
      ],
    );

    const diagnostics = detectCycles(pipeline);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe(GRAPH_CYCLE_DETECTED);
  });

  it('detects a self-referencing node', () => {
    const pipeline = makePipeline(
      [{ id: 'A', capability: { id: 'cap.one' } }],
      [{ from: 'A.output', to: 'A.input' }],
    );

    const diagnostics = detectCycles(pipeline);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe(GRAPH_CYCLE_DETECTED);
    expect(diagnostics[0]!.message).toContain('A');
  });

  it('ignores edges from pipeline inputs', () => {
    const pipeline = makePipeline(
      [
        { id: 'A', capability: { id: 'cap.one' } },
        { id: 'B', capability: { id: 'cap.two' } },
      ],
      [
        { from: 'input.regionId', to: 'A.regionId' },
        { from: 'A.output', to: 'B.input' },
      ],
    );

    const diagnostics = detectCycles(pipeline);
    expect(diagnostics).toHaveLength(0);
  });

  it('returns no diagnostics for an empty pipeline', () => {
    const pipeline = makePipeline([], []);
    const diagnostics = detectCycles(pipeline);
    expect(diagnostics).toHaveLength(0);
  });
});
