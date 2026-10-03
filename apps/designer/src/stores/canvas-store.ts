import { applyNodeChanges } from '@xyflow/react';
import { canvasInitial, type CanvasActions, type PipelineSet, type PipelineGet } from './types.js';

export const createCanvasSlice = (set: PipelineSet, get: PipelineGet): CanvasActions => ({
  // Dragging a node about does not change the question, only where it sits.
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  loadPipeline: (nodes, edges) => {
    set({ nodes, edges, selectedNodeId: null });
  },

  openComposite: (entry) => {
    set({ drilldownStack: [...get().drilldownStack, entry] });
  },

  closeComposite: () => {
    set({ drilldownStack: get().drilldownStack.slice(0, -1) });
  },

  reset: () => {
    set({ ...canvasInitial });
  },
});
