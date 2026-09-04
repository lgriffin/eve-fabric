import { create } from 'zustand';
import { withHistory, type HistoryActions } from './history-middleware.js';
import { createCanvasSlice } from './canvas-store.js';
import { createCompilationSlice } from './compilation-store.js';
import { createExecutionSlice } from './execution-store.js';
import { createPersistenceSlice } from './persistence-store.js';
import {
  type PipelineState,
  canvasInitial,
  compilationInitial,
  executionInitial,
  persistenceInitial,
} from './types.js';

/* The pipeline store is composed of four single-responsibility slices
   (T042). Call sites and the history middleware both rely on a single
   combined store handle, so we assemble them here behind one store. */
type PipelineStore = PipelineState & HistoryActions;

export const usePipelineStore = create<PipelineStore>()(
  withHistory(
    (set, get) => ({
      // Initial state (one const per slice -> four single-responsibility slices).
      ...canvasInitial,
      ...compilationInitial,
      ...executionInitial,
      ...persistenceInitial,

      // Behavioural actions, each owned by a focused slice module.
      ...createCanvasSlice(set, get),
      ...createCompilationSlice(set),
      ...createExecutionSlice(set, get),
      ...createPersistenceSlice(set, get),
    }),
    { maxEntries: 50 },
  ),
);

/* Re-export the public type surface so that existing importers of
   `stores/pipeline-store.js` keep resolving as before. */
export type {
  ExecutionNodeState,
  ExecutionStepMetrics,
  BridgingSuggestion,
  CapabilityNodeData,
  CapabilityFlowNode,
  DrilldownEntry,
} from './types.js';
