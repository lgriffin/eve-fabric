import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { withHistory, type HistoryActions } from '../../src/stores/history-middleware.js';

interface TestState {
  nodes: Array<{ id: string }>;
  edges: Array<{ id: string }>;
  addNode: (id: string) => void;
  removeNode: (id: string) => void;
  addEdge: (id: string) => void;
}

function createTestStore() {
  return create<TestState & HistoryActions>()(
    withHistory(
      (set, get) => ({
        nodes: [],
        edges: [],
        addNode: (id) => {
          set({ nodes: [...get().nodes, { id }] });
        },
        removeNode: (id) => {
          set({
            nodes: get().nodes.filter((n) => n.id !== id),
            edges: get().edges.filter((e) => e.id !== `e-${id}`),
          });
        },
        addEdge: (id) => {
          set({ edges: [...get().edges, { id }] });
        },
      }),
      { maxEntries: 50 },
    ),
  );
}

describe('history-middleware', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('starts with empty history', () => {
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(false);
    expect(store.getState().undoCount).toBe(0);
    expect(store.getState().redoCount).toBe(0);
  });

  it('records state before mutations', () => {
    store.getState().addNode('a');
    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().canUndo).toBe(true);
    expect(store.getState().undoCount).toBe(1);
  });

  it('undoes a mutation', () => {
    store.getState().addNode('a');
    store.getState().undo();
    expect(store.getState().nodes).toHaveLength(0);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(true);
  });

  it('redoes an undone mutation', () => {
    store.getState().addNode('a');
    store.getState().undo();
    store.getState().redo();
    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().nodes[0]!.id).toBe('a');
    expect(store.getState().canRedo).toBe(false);
  });

  it('clears redo stack on new mutation after undo', () => {
    store.getState().addNode('a');
    store.getState().addNode('b');
    store.getState().undo();
    expect(store.getState().canRedo).toBe(true);

    store.getState().addNode('c');
    expect(store.getState().canRedo).toBe(false);
    expect(store.getState().redoCount).toBe(0);
  });

  it('handles multiple undo/redo in sequence', () => {
    store.getState().addNode('a');
    store.getState().addNode('b');
    store.getState().addNode('c');

    store.getState().undo();
    expect(store.getState().nodes).toHaveLength(2);

    store.getState().undo();
    expect(store.getState().nodes).toHaveLength(1);

    store.getState().redo();
    expect(store.getState().nodes).toHaveLength(2);
  });

  it('no-ops undo on empty history', () => {
    store.getState().undo();
    expect(store.getState().nodes).toHaveLength(0);
  });

  it('no-ops redo on empty redo stack', () => {
    store.getState().addNode('a');
    store.getState().redo();
    expect(store.getState().nodes).toHaveLength(1);
  });

  it('caps undo stack at maxEntries', () => {
    const smallStore = create<TestState & HistoryActions>()(
      withHistory(
        (set, get) => ({
          nodes: [],
          edges: [],
          addNode: (id) => {
            set({ nodes: [...get().nodes, { id }] });
          },
          removeNode: (id) => {
            set({ nodes: get().nodes.filter((n) => n.id !== id) });
          },
          addEdge: (id) => {
            set({ edges: [...get().edges, { id }] });
          },
        }),
        { maxEntries: 5 },
      ),
    );

    for (let i = 0; i < 10; i++) {
      smallStore.getState().addNode(`n${i}`);
    }

    expect(smallStore.getState().undoCount).toBe(5);
  });

  it('captures both nodes and edges in snapshot', () => {
    store.getState().addNode('a');
    store.getState().addEdge('e-a');

    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().edges).toHaveLength(1);

    store.getState().removeNode('a');
    expect(store.getState().nodes).toHaveLength(0);
    expect(store.getState().edges).toHaveLength(0);

    store.getState().undo();
    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().edges).toHaveLength(1);
  });
});
