import { describe, it, expect } from 'vitest';
import {
  flowToPipeline,
  pipelineToYaml,
  pipelineToFlow,
} from '../../src/services/pipeline-serializer.js';
import type { CapabilityFlowNode } from '../../src/stores/pipeline-store.js';
import type { PipelineDefinition } from '@eve-fabric/domain';

function makeFlowNode(id: string, capabilityId: string): CapabilityFlowNode {
  return {
    id,
    type: 'capability',
    position: { x: 0, y: 0 },
    data: {
      capabilityId,
      capabilityVersion: '1.0.0',
      label: id,
      source: 'ESI',
      inputs: [],
      outputs: [],
    },
  };
}

describe('Pipeline Serializer', () => {
  describe('flowToPipeline', () => {
    it('converts flow nodes and edges to a PipelineDefinition', () => {
      const nodes = [
        makeFlowNode('resolve-item', 'universe.resolveType'),
        makeFlowNode('orders', 'market.orders'),
      ];

      const edges = [
        {
          id: 'e-0',
          source: 'resolve-item',
          sourceHandle: 'type',
          target: 'orders',
          targetHandle: 'item',
        },
      ];

      const result = flowToPipeline(
        nodes,
        edges,
        {
          id: 'test-pipeline',
          name: 'Test Pipeline',
          version: 1,
        },
        [],
        [],
      );

      expect(result.id).toBe('test-pipeline');
      expect(result.version).toBe(1);
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]!.from).toBe('resolve-item.type');
      expect(result.edges[0]!.to).toBe('orders.item');
    });

    it('handles edges without handles', () => {
      const nodes = [makeFlowNode('a', 'test.cap')];
      const edges = [{ id: 'e-0', source: 'a', target: 'b' }];

      const result = flowToPipeline(
        nodes,
        edges,
        {
          id: 'test',
          name: 'Test',
          version: 1,
        },
        [],
        [],
      );

      expect(result.edges[0]!.from).toBe('a');
      expect(result.edges[0]!.to).toBe('b');
    });
  });

  describe('pipelineToFlow', () => {
    it('converts a PipelineDefinition to flow nodes and edges', () => {
      const definition: PipelineDefinition = {
        id: 'test',
        version: 1,
        name: 'Test',
        inputs: [],
        outputs: [],
        nodes: [
          { id: 'a', capability: { id: 'market.orders' as any } },
          { id: 'b', capability: { id: 'market.aggregate' as any } },
        ],
        edges: [{ from: 'a.orders', to: 'b.orders' }],
      };

      const { nodes, edges } = pipelineToFlow(definition);
      expect(nodes).toHaveLength(2);
      expect(edges).toHaveLength(1);
      expect(edges[0]!.source).toBe('a');
      expect(edges[0]!.sourceHandle).toBe('orders');
      expect(edges[0]!.target).toBe('b');
      expect(edges[0]!.targetHandle).toBe('orders');
    });
  });

  describe('pipelineToYaml', () => {
    it('produces valid YAML representation', () => {
      const definition: PipelineDefinition = {
        id: 'trade-opportunity',
        version: 1,
        name: 'Trade Opportunity',
        description: 'Find cheapest market orders',
        inputs: [{ name: 'item', semanticType: 'eve.type.reference' as any, required: true }],
        outputs: [{ name: 'sellPrice', source: 'aggregate.lowestSell' }],
        nodes: [{ id: 'orders', capability: { id: 'market.orders' as any } }],
        edges: [{ from: 'input.item', to: 'orders.item' }],
      };

      const yaml = pipelineToYaml(definition);
      expect(yaml).toContain('id: trade-opportunity');
      expect(yaml).toContain('version: 1');
      expect(yaml).toContain('name: Trade Opportunity');
      expect(yaml).toContain('description: Find cheapest market orders');
      expect(yaml).toContain('type: eve.type.reference');
      expect(yaml).toContain('required: true');
      expect(yaml).toContain('capability: market.orders');
      expect(yaml).toContain('from: input.item');
      expect(yaml).toContain('to: orders.item');
      expect(yaml).toContain('sellPrice: aggregate.lowestSell');
    });
  });
});
