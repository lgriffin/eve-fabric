import { describe, it, expect } from 'vitest';
import { applyAutoLayout } from '../../src/services/layout-engine.js';
import type { Node, Edge } from '@xyflow/react';

function makeNode(id: string, x = 0, y = 0): Node {
  return { id, type: 'default', position: { x, y }, data: {} };
}

describe('Layout Engine', () => {
  it('positions nodes left-to-right in LR layout', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ];

    const result = applyAutoLayout(nodes, edges);

    expect(result).toHaveLength(3);
    const xA = result.find((n) => n.id === 'a')!.position.x;
    const xB = result.find((n) => n.id === 'b')!.position.x;
    const xC = result.find((n) => n.id === 'c')!.position.x;
    expect(xA).toBeLessThan(xB);
    expect(xB).toBeLessThan(xC);
  });

  it('produces no overlapping nodes', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'a', target: 'c' },
      { id: 'e3', source: 'b', target: 'd' },
      { id: 'e4', source: 'c', target: 'd' },
    ];

    const result = applyAutoLayout(nodes, edges);
    const width = 200;
    const height = 80;

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i]!;
        const b = result[j]!;
        const overlapX = Math.abs(a.position.x - b.position.x) < width;
        const overlapY = Math.abs(a.position.y - b.position.y) < height;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });

  it('handles a single node', () => {
    const nodes = [makeNode('only')];
    const result = applyAutoLayout(nodes, []);

    expect(result).toHaveLength(1);
    expect(typeof result[0]!.position.x).toBe('number');
    expect(typeof result[0]!.position.y).toBe('number');
  });

  it('handles disconnected nodes (no edges)', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const result = applyAutoLayout(nodes, []);

    expect(result).toHaveLength(3);
    for (const node of result) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
  });

  it('returns empty array for empty input', () => {
    const result = applyAutoLayout([], []);
    expect(result).toHaveLength(0);
  });

  it('preserves node data and type', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'capability', position: { x: 0, y: 0 }, data: { label: 'Test' } },
    ];
    const result = applyAutoLayout(nodes, []);

    expect(result[0]!.type).toBe('capability');
    expect(result[0]!.data).toEqual({ label: 'Test' });
  });
});
