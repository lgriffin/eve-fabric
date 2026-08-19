import { describe, it, expect, beforeEach } from 'vitest';
import { usePipelineStore, type CapabilityFlowNode } from '../../src/stores/pipeline-store.js';

function makeNode(overrides: Partial<CapabilityFlowNode> = {}): CapabilityFlowNode {
  return {
    id: 'test-node-1',
    type: 'capability',
    position: { x: 100, y: 100 },
    data: {
      capabilityId: 'market.orders',
      capabilityVersion: 1,
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

describe('PipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.getState().reset();
  });

  it('starts with empty state', () => {
    const state = usePipelineStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
    expect(state.isDirty).toBe(false);
  });

  it('adds a node', () => {
    usePipelineStore.getState().addNode(makeNode());
    const state = usePipelineStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0]!.id).toBe('test-node-1');
    expect(state.isDirty).toBe(true);
  });

  it('removes a node and its edges', () => {
    const store = usePipelineStore.getState();
    store.addNode(makeNode({ id: 'a' }));
    store.addNode(makeNode({ id: 'b' }));
    store.onConnect({
      source: 'a',
      target: 'b',
      sourceHandle: 'orders',
      targetHandle: 'item',
    });

    expect(usePipelineStore.getState().edges).toHaveLength(1);

    usePipelineStore.getState().removeNode('a');
    const state = usePipelineStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.edges).toHaveLength(0);
  });

  it('creates an edge on connect', () => {
    const store = usePipelineStore.getState();
    store.addNode(makeNode({ id: 'source-node' }));
    store.addNode(makeNode({ id: 'target-node' }));

    store.onConnect({
      source: 'source-node',
      target: 'target-node',
      sourceHandle: 'orders',
      targetHandle: 'item',
    });

    const state = usePipelineStore.getState();
    expect(state.edges).toHaveLength(1);
    expect(state.edges[0]!.source).toBe('source-node');
    expect(state.edges[0]!.target).toBe('target-node');
  });

  it('sets diagnostics', () => {
    usePipelineStore.getState().setDiagnostics([
      {
        code: 'SEMANTIC_TYPE_MISMATCH',
        severity: 'error',
        message: 'Type mismatch on edge',
      },
    ]);

    const state = usePipelineStore.getState();
    expect(state.diagnostics).toHaveLength(1);
    expect(state.diagnostics[0]!.severity).toBe('error');
  });

  it('tracks selected node', () => {
    usePipelineStore.getState().addNode(makeNode());
    usePipelineStore.getState().setSelectedNode('test-node-1');
    expect(usePipelineStore.getState().selectedNodeId).toBe('test-node-1');

    usePipelineStore.getState().setSelectedNode(null);
    expect(usePipelineStore.getState().selectedNodeId).toBeNull();
  });

  it('updates pipeline metadata', () => {
    usePipelineStore.getState().setPipelineMeta({
      id: 'trade-opportunity',
      name: 'Trade Opportunity',
      version: 2,
    });

    const state = usePipelineStore.getState();
    expect(state.pipelineId).toBe('trade-opportunity');
    expect(state.pipelineName).toBe('Trade Opportunity');
    expect(state.pipelineVersion).toBe(2);
    expect(state.isDirty).toBe(true);
  });

  it('resets to initial state', () => {
    const store = usePipelineStore.getState();
    store.addNode(makeNode());
    store.setPipelineMeta({ name: 'Test' });

    store.reset();
    const state = usePipelineStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.pipelineName).toBe('Untitled Pipeline');
    expect(state.isDirty).toBe(false);
  });
});

describe('Connection Validation', () => {
  beforeEach(() => {
    usePipelineStore.getState().reset();
  });

  it('accepts compatible semantic type connections', () => {
    const store = usePipelineStore.getState();
    store.addNode(
      makeNode({
        id: 'resolver',
        data: {
          capabilityId: 'universe.resolveType',
          capabilityVersion: 1,
          label: 'Resolve Type',
          source: 'SDE',
          inputs: [{ name: 'item', semanticType: 'eve.type.reference', required: true }],
          outputs: [{ name: 'type', semanticType: 'eve.type.reference' }],
        },
      }),
    );
    store.addNode(
      makeNode({
        id: 'orders',
        data: {
          capabilityId: 'market.orders',
          capabilityVersion: 1,
          label: 'Market Orders',
          source: 'ESI',
          inputs: [{ name: 'item', semanticType: 'eve.type.reference', required: true }],
          outputs: [{ name: 'orders', semanticType: 'eve.market.orders' }],
        },
      }),
    );

    const nodes = usePipelineStore.getState().nodes;
    const sourceNode = nodes.find((n) => n.id === 'resolver')!;
    const targetNode = nodes.find((n) => n.id === 'orders')!;

    const sourcePort = sourceNode.data.outputs.find((o) => o.name === 'type');
    const targetPort = targetNode.data.inputs.find((i) => i.name === 'item');

    expect(sourcePort!.semanticType).toBe(targetPort!.semanticType);
  });

  it('rejects incompatible semantic type connections', () => {
    const store = usePipelineStore.getState();
    store.addNode(
      makeNode({
        id: 'resolver',
        data: {
          capabilityId: 'universe.resolveRegion',
          capabilityVersion: 1,
          label: 'Resolve Region',
          source: 'SDE',
          inputs: [{ name: 'region', semanticType: 'eve.region.reference', required: true }],
          outputs: [{ name: 'region', semanticType: 'eve.region.reference' }],
        },
      }),
    );
    store.addNode(
      makeNode({
        id: 'orders',
        data: {
          capabilityId: 'market.orders',
          capabilityVersion: 1,
          label: 'Market Orders',
          source: 'ESI',
          inputs: [{ name: 'item', semanticType: 'eve.type.reference', required: true }],
          outputs: [{ name: 'orders', semanticType: 'eve.market.orders' }],
        },
      }),
    );

    const nodes = usePipelineStore.getState().nodes;
    const sourceNode = nodes.find((n) => n.id === 'resolver')!;
    const targetNode = nodes.find((n) => n.id === 'orders')!;

    const sourcePort = sourceNode.data.outputs.find((o) => o.name === 'region');
    const targetPort = targetNode.data.inputs.find((i) => i.name === 'item');

    expect(sourcePort!.semanticType).not.toBe(targetPort!.semanticType);
  });
});
