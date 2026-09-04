import type { ExecutionSliceActions, PipelineSet, PipelineGet } from './types.js';

export const createExecutionSlice = (
  set: PipelineSet,
  get: PipelineGet,
): ExecutionSliceActions => ({
  setExecutionSession: (session) => {
    set({ executionSession: session });
  },

  updateStepStatus: (stepId, status, metrics) => {
    const session = get().executionSession;
    if (!session) return;
    set({
      executionSession: {
        ...session,
        stepStatuses: { ...session.stepStatuses, [stepId]: status },
        stepMetrics: metrics ? { ...session.stepMetrics, [stepId]: metrics } : session.stepMetrics,
      },
    });
  },

  setExecutionOutputs: (outputs) => {
    const session = get().executionSession;
    if (!session) return;
    set({
      executionSession: {
        ...session,
        status: 'completed',
        outputs,
      },
    });
  },

  setNodeExecutionState: (nodeId, state) => {
    set({
      nodeExecutionStates: {
        ...get().nodeExecutionStates,
        [nodeId]: state,
      },
    });
  },
});
