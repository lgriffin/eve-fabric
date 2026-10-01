import type { StateCreator, StoreMutatorIdentifier } from 'zustand';

interface HistorySnapshot {
  nodes: unknown[];
  edges: unknown[];
}

export interface HistoryActions {
  undo: () => void;
  redo: () => void;
  /** Forgets every snapshot: what is on the canvas now has no history. */
  clearHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

interface HistoryOptions {
  maxEntries?: number;
}

type WithHistory = <
  T extends { nodes: unknown[]; edges: unknown[] },
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
  options?: HistoryOptions,
) => StateCreator<T & HistoryActions, Mps, Mcs>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const withHistory: WithHistory = (f: any, options) => (set, get, api) => {
  const maxEntries = options?.maxEntries ?? 50;
  const undoStack: HistorySnapshot[] = [];
  const redoStack: HistorySnapshot[] = [];
  let isUndoRedo = false;

  function snapshot(): HistorySnapshot {
    const state = get();
    return { nodes: [...state.nodes], edges: [...state.edges] };
  }

  function updateFlags() {
    set({
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
    } as Partial<ReturnType<typeof get>>);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trackedSet: typeof set = ((partial: any, replace?: any) => {
    if (!isUndoRedo) {
      undoStack.push(snapshot());
      if (undoStack.length > maxEntries) {
        undoStack.shift();
      }
      redoStack.length = 0;
    }
    (set as (...args: unknown[]) => void)(partial, replace);
    if (!isUndoRedo) {
      updateFlags();
    }
  }) as typeof set;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const initialState = f(trackedSet, get, api);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    ...initialState,
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,

    clearHistory: () => {
      undoStack.length = 0;
      redoStack.length = 0;
      updateFlags();
    },

    undo: () => {
      const entry = undoStack.pop();
      if (!entry) return;
      isUndoRedo = true;
      redoStack.push(snapshot());
      set({ nodes: entry.nodes, edges: entry.edges } as Partial<ReturnType<typeof get>>);
      updateFlags();
      isUndoRedo = false;
    },

    redo: () => {
      const entry = redoStack.pop();
      if (!entry) return;
      isUndoRedo = true;
      undoStack.push(snapshot());
      set({ nodes: entry.nodes, edges: entry.edges } as Partial<ReturnType<typeof get>>);
      updateFlags();
      isUndoRedo = false;
    },
  };
};
