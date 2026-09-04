import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { CanvasSliceActions, PipelineSet, PipelineGet } from './types.js';

export const createCanvasSlice = (set: PipelineSet, get: PipelineGet): CanvasSliceActions => ({
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
      isDirty: true,
    });
  },

  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
      isDirty: true,
    });
  },

  removeNode: (nodeId) => {
    const configuredValues = { ...get().nodeConfiguredValues };
    delete configuredValues[nodeId];
    const executionStates = { ...get().nodeExecutionStates };
    delete executionStates[nodeId];
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      nodeConfiguredValues: configuredValues,
      nodeExecutionStates: executionStates,
      isDirty: true,
    });
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },
});
