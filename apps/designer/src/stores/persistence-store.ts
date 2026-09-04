import type { PersistenceSliceActions, PipelineSet, PipelineGet } from './types.js';
import {
  canvasInitial,
  compilationInitial,
  executionInitial,
  persistenceInitial,
} from './types.js';
import { useToastStore } from './toast-store.js';

export const createPersistenceSlice = (
  set: PipelineSet,
  get: PipelineGet,
): PersistenceSliceActions => ({
  setPipeline: (_definition) => {
    set({ isDirty: false });
  },

  setPipelineMeta: (meta) => {
    set({
      pipelineId: meta.id ?? get().pipelineId,
      pipelineName: meta.name ?? get().pipelineName,
      pipelineVersion: meta.version ?? get().pipelineVersion,
      isDirty: true,
    });
  },

  loadPipeline: (nodes, edges, meta, configuredValues) => {
    set({
      nodes,
      edges,
      pipelineId: meta.id,
      pipelineName: meta.name,
      pipelineVersion: meta.version,
      isDirty: false,
      diagnostics: [],
      compiledPlan: null,
      graphqlSdl: null,
      executionSession: null,
      bridgingSuggestions: [],
      nodeConfiguredValues: configuredValues ?? {},
      nodeExecutionStates: {},
    });
  },

  openComposite: (entry) => {
    set({ drilldownStack: [...get().drilldownStack, entry] });
  },

  closeComposite: () => {
    const stack = get().drilldownStack;
    set({ drilldownStack: stack.slice(0, -1) });
  },

  publishAsCapability: async (options) => {
    const state = get();
    set({ isPublishing: true });
    try {
      const response = await fetch('/api/registry/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilityId: options.capabilityId,
          version: options.version,
          name: options.name,
          description: options.description,
          pipelineId: state.pipelineId,
          pipelineVersion: state.pipelineVersion,
          selectedInputs: options.selectedInputs,
          selectedOutputs: options.selectedOutputs,
        }),
      });
      const result = (await response.json()) as {
        success: boolean;
        diagnostics: Array<{ message: string }>;
      };
      set({ isPublishing: false });
      if (result.success) {
        useToastStore
          .getState()
          .addToast('success', 'Published', `Capability ${options.name} published successfully`);
      } else {
        useToastStore
          .getState()
          .addToast('error', 'Publish failed', result.diagnostics.map((d) => d.message).join('; '));
      }
      return result;
    } catch (err) {
      set({ isPublishing: false });
      const msg = err instanceof Error ? err.message : 'Failed to publish';
      useToastStore.getState().addToast('error', 'Publish failed', msg);
      return {
        success: false,
        diagnostics: [{ message: msg }],
      };
    }
  },

  reset: () => {
    set({
      ...canvasInitial,
      ...compilationInitial,
      ...executionInitial,
      ...persistenceInitial,
    });
  },

  setNodeInputValue: (nodeId, portName, value) => {
    const current = get().nodeConfiguredValues;
    set({
      nodeConfiguredValues: {
        ...current,
        [nodeId]: { ...current[nodeId], [portName]: value },
      },
      isDirty: true,
    });
  },

  clearNodeInputValue: (nodeId, portName) => {
    const current = get().nodeConfiguredValues;
    const nodeValues = { ...current[nodeId] };
    delete nodeValues[portName];
    set({
      nodeConfiguredValues: { ...current, [nodeId]: nodeValues },
      isDirty: true,
    });
  },
});
