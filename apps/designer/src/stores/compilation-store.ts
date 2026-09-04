import type { CompilationSliceActions, PipelineSet } from './types.js';

export const createCompilationSlice = (set: PipelineSet): CompilationSliceActions => ({
  setDiagnostics: (diagnostics) => {
    set({ diagnostics });
  },

  setCompiledPlan: (plan) => {
    set({ compiledPlan: plan });
  },

  setGraphqlSdl: (sdl) => {
    set({ graphqlSdl: sdl });
  },

  setBridgingSuggestions: (suggestions) => {
    set({ bridgingSuggestions: suggestions });
  },
});
