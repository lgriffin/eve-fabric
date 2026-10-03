import { describe, it, expect, beforeEach } from 'vitest';
import { usePipelineStore, type CapabilityFlowNode } from '../../src/stores/pipeline-store.js';

function makeNode(overrides: Partial<CapabilityFlowNode> = {}): CapabilityFlowNode {
  return {
    id: 'test-node-1',
    type: 'capability',
    position: { x: 100, y: 100 },
    data: {
      capabilityId: 'market.orders',
      capabilityVersion: '1.0.0',
      label: 'Market Orders',
      source: 'ESI',
      inputs: [
        { name: 'item', semanticType: 'eve.type.reference', required: true },
        { name: 'region', semanticType: 'eve.region.reference', required: true },
      ],
      outputs: [{ name: 'orders', semanticType: 'eve.market.orders' }],
    },
    ...overrides,
  };
}

const edge = { id: 'e-0', source: 'a', sourceHandle: 'orders', target: 'b', targetHandle: 'item' };

describe('PipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.getState().reset();
  });

  it('starts empty', () => {
    const state = usePipelineStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
    expect(state.selectedNodeId).toBeNull();
    expect(state.drilldownStack).toHaveLength(0);
  });

  it('shows a scaffold in place of the one before, and forgets the selection', () => {
    const store = usePipelineStore.getState();
    store.loadPipeline([makeNode({ id: 'a' }), makeNode({ id: 'b' })], [edge]);
    store.setSelectedNode('a');
    store.loadPipeline([makeNode({ id: 'c' })], []);
    const state = usePipelineStore.getState();
    expect(state.nodes.map((n) => n.id)).toEqual(['c']);
    expect(state.edges).toHaveLength(0);
    expect(state.selectedNodeId).toBeNull();
  });

  it('moves a node where it is dragged', () => {
    const store = usePipelineStore.getState();
    store.loadPipeline([makeNode({ id: 'a' })], []);
    store.onNodesChange([{ type: 'position', id: 'a', position: { x: 5, y: 7 } }]);
    expect(usePipelineStore.getState().nodes[0]!.position).toEqual({ x: 5, y: 7 });
  });

  it('has no way to add, remove or connect nodes', () => {
    const store = usePipelineStore.getState() as unknown as Record<string, unknown>;
    expect(store['addNode']).toBeUndefined();
    expect(store['removeNode']).toBeUndefined();
    expect(store['onConnect']).toBeUndefined();
  });

  it('tracks the selected node', () => {
    usePipelineStore.getState().loadPipeline([makeNode()], []);
    usePipelineStore.getState().setSelectedNode('test-node-1');
    expect(usePipelineStore.getState().selectedNodeId).toBe('test-node-1');

    usePipelineStore.getState().setSelectedNode(null);
    expect(usePipelineStore.getState().selectedNodeId).toBeNull();
  });

  it('opens and closes composites in a stack', () => {
    const store = usePipelineStore.getState();
    store.openComposite({ capabilityId: 'x.one', version: '1.0.0', pipelineDef: null });
    store.openComposite({ capabilityId: 'x.two', version: '1.0.0', pipelineDef: null });
    expect(usePipelineStore.getState().drilldownStack.map((e) => e.capabilityId)).toEqual([
      'x.one',
      'x.two',
    ]);
    store.closeComposite();
    expect(usePipelineStore.getState().drilldownStack.map((e) => e.capabilityId)).toEqual([
      'x.one',
    ]);
  });

  it('resets to its initial state', () => {
    const store = usePipelineStore.getState();
    store.loadPipeline([makeNode()], []);
    store.setSelectedNode('test-node-1');
    store.reset();
    const state = usePipelineStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.selectedNodeId).toBeNull();
  });
});
