import { describe, it, expect, beforeEach } from 'vitest';
import { useDraftStore } from '../../src/stores/draft-store.js';
import type { CapabilityFlowNode } from '../../src/stores/types.js';

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

describe('the canvas in the draft store', () => {
  beforeEach(() => {
    useDraftStore.getState().clear();
  });

  it('starts empty', () => {
    const state = useDraftStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
    expect(state.selectedNodeId).toBeNull();
  });

  it('moves a node where it is dragged', () => {
    useDraftStore.setState({ nodes: [makeNode({ id: 'a' })], edges: [] });
    useDraftStore
      .getState()
      .onNodesChange([{ type: 'position', id: 'a', position: { x: 5, y: 7 } }]);
    expect(useDraftStore.getState().nodes[0]!.position).toEqual({ x: 5, y: 7 });
  });

  it('has no way to add, remove or connect nodes', () => {
    const store = useDraftStore.getState() as unknown as Record<string, unknown>;
    expect(store['addNode']).toBeUndefined();
    expect(store['removeNode']).toBeUndefined();
    expect(store['onConnect']).toBeUndefined();
    expect(store['loadPipeline']).toBeUndefined();
  });

  it('tracks the selected node', () => {
    useDraftStore.setState({ nodes: [makeNode()] });
    useDraftStore.getState().selectNode('test-node-1');
    expect(useDraftStore.getState().selectedNodeId).toBe('test-node-1');
    useDraftStore.getState().selectNode(null);
    expect(useDraftStore.getState().selectedNodeId).toBeNull();
  });

  it('lays the scaffold out again on request, left to right', () => {
    useDraftStore.setState({
      nodes: [makeNode({ id: 'b', position: { x: 0, y: 0 } }), makeNode({ id: 'a' })],
      edges: [edge],
    });
    useDraftStore.getState().relayout();
    const [b, a] = useDraftStore.getState().nodes;
    expect(a!.position.x).toBeLessThan(b!.position.x);
  });

  it('clears with the question', () => {
    useDraftStore.setState({ nodes: [makeNode()], edges: [edge], selectedNodeId: 'test-node-1' });
    useDraftStore.getState().clear();
    const state = useDraftStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
    expect(state.selectedNodeId).toBeNull();
  });
});
