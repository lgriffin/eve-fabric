import { describe, it, expect } from 'vitest';
import { pipelineToFlow, enrichNodesWithCatalog } from '../../src/services/pipeline-serializer.js';
import type { PipelineDefinition } from '@eve-fabric/core';

const definition: PipelineDefinition = {
  id: 'test',
  version: 1,
  name: 'Test',
  inputs: [],
  outputs: [],
  nodes: [
    { id: 'a', capability: { id: 'market.orders' as never } },
    { id: 'b', capability: { id: 'market.aggregate' as never, version: '2.0.0' as never } },
  ],
  edges: [
    { from: 'a.orders', to: 'b.orders' },
    { from: 'a.orders', to: 'missing.orders' },
    { from: 'a', to: 'b' },
  ],
};

describe('Pipeline Serializer', () => {
  describe('pipelineToFlow', () => {
    it('converts a PipelineDefinition to flow nodes and edges', () => {
      const { nodes, edges } = pipelineToFlow(definition);
      expect(nodes.map((n) => n.id)).toEqual(['a', 'b']);
      expect(nodes[0]!.data.capabilityVersion).toBe('1.0.0');
      expect(nodes[1]!.data.capabilityVersion).toBe('2.0.0');
      expect(edges[0]!.source).toBe('a');
      expect(edges[0]!.sourceHandle).toBe('orders');
      expect(edges[0]!.target).toBe('b');
      expect(edges[0]!.targetHandle).toBe('orders');
    });

    it('drops an edge to a node the pipeline does not have', () => {
      const { edges } = pipelineToFlow(definition);
      expect(edges.map((e) => e.target)).toEqual(['b', 'b']);
    });

    it('reads a bare node reference as the node with no port', () => {
      const { edges } = pipelineToFlow(definition);
      expect(edges[1]!.sourceHandle).toBe('');
      expect(edges[1]!.targetHandle).toBe('');
    });

    it('places nodes on a grid', () => {
      const many: PipelineDefinition = {
        ...definition,
        edges: [],
        nodes: Array.from({ length: 5 }, (_, i) => ({
          id: `n${i}`,
          capability: { id: 'x.y' as never },
        })),
      };
      const { nodes } = pipelineToFlow(many);
      expect(nodes[0]!.position).toEqual({ x: 50, y: 50 });
      expect(nodes[4]!.position.x).toBe(50);
      expect(nodes[4]!.position.y).toBeGreaterThan(50);
    });
  });

  describe('enrichNodesWithCatalog', () => {
    it('names nodes and gives them their ports from the catalog', () => {
      const { nodes } = pipelineToFlow(definition);
      const catalog = new Map([
        [
          'market.orders',
          {
            name: 'Market Orders',
            source: 'ESI',
            inputs: [{ name: 'item', semanticType: 'eve.type.reference', required: true }],
            outputs: [{ name: 'orders', semanticType: 'eve.market.orders' }],
          },
        ],
      ]);
      const enriched = enrichNodesWithCatalog(nodes, catalog);
      expect(enriched[0]!.data.label).toBe('Market Orders');
      expect(enriched[0]!.data.source).toBe('ESI');
      expect(enriched[0]!.data.inputs).toHaveLength(1);
      // A capability the catalog does not know keeps what the pipeline said.
      expect(enriched[1]!.data.label).toBe('b');
      expect(enriched[1]!.data.inputs).toHaveLength(0);
    });
  });
});
