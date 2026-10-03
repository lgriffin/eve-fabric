import { create } from 'zustand';
import { createCanvasSlice } from './canvas-store.js';
import { canvasInitial, type PipelineState } from './types.js';

/** The canvas: a read-only view of the open question's scaffold. */
export const usePipelineStore = create<PipelineState>()((set, get) => ({
  ...canvasInitial,
  ...createCanvasSlice(set, get),
}));

export type { CapabilityNodeData, CapabilityFlowNode, DrilldownEntry } from './types.js';
