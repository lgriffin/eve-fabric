import { create } from 'zustand';
import type { Edge } from '@xyflow/react';
import type { DraftSubject } from '@eve-fabric/fabric';
import {
  postDraft,
  runDraft,
  type DraftChange,
  type DraftRequest,
  type DraftView,
} from '../services/draft-client.js';
import { enrichNodesWithCatalog, pipelineToFlow } from '../services/pipeline-serializer.js';
import { applyAutoLayout } from '../services/layout-engine.js';
import { useCatalogStore } from './catalog-store.js';
import { usePipelineStore } from './pipeline-store.js';

/**
 * The question being built. It holds what the draft started from and the
 * changes made, in order; every change goes to the fabric, which answers
 * with what the draft now offers. The canvas shows the resulting scaffold.
 */
interface DraftState {
  subject: DraftSubject | null;
  steps: DraftChange[];
  view: DraftView | null;
  /** An EVE SSO access token, for moves that need a character's scope. */
  token: string;
  answer: unknown;
  error: string | null;
  busy: boolean;
}

interface DraftActions {
  start: (subject: DraftSubject) => Promise<boolean>;
  apply: (move: string) => Promise<boolean>;
  fill: (hole: string, value: unknown) => Promise<boolean>;
  undo: () => Promise<boolean>;
  load: (graphql: string) => Promise<boolean>;
  run: () => Promise<boolean>;
  /** Asks the fabric again, after it changed (a weave was added). */
  refresh: () => Promise<boolean>;
  setToken: (token: string) => void;
  clear: () => void;
  /** Drops the question without touching the canvas, for a pipeline loaded in its place. */
  leave: () => void;
}

/** How long typing in the token field waits before asking the fabric again. */
const TOKEN_SETTLE_MS = 300;

const initial: DraftState = {
  subject: null,
  steps: [],
  view: null,
  token: '',
  answer: undefined,
  error: null,
  busy: false,
};

/** The draft's pipeline on the canvas, laid out; fields read off a port label the edge. */
function showOnCanvas(view: DraftView): void {
  const { nodes, edges } = pipelineToFlow(view.pipeline);
  const catalog = new Map(
    useCatalogStore
      .getState()
      .capabilities.map((c) => [
        c.id,
        { name: c.name, source: c.source, inputs: c.inputs, outputs: c.outputs },
      ]),
  );
  const ported: Edge[] = edges.map((edge) => {
    const [port = '', ...fields] = (edge.sourceHandle ?? '').split('.');
    return fields.length === 0 ? edge : { ...edge, sourceHandle: port, label: fields.join('.') };
  });
  const laid = applyAutoLayout(enrichNodesWithCatalog(nodes, catalog), ported);
  const canvas = usePipelineStore.getState();
  canvas.loadPipeline(laid, ported, { id: 'draft', name: 'Question', version: 1 });
  // The question's own steps are its history; the canvas keeps none of it.
  canvas.clearHistory();
}

export const useDraftStore = create<DraftState & DraftActions>()((set, get) => {
  // Each request takes a number; a reply to any but the latest is dropped,
  // so replies arriving out of order never undo a newer change.
  let latest = 0;
  let tokenTimer: ReturnType<typeof setTimeout> | undefined;

  /** Sends a draft to the fabric; keeps it only if the fabric accepts it. */
  const send = async (
    request: DraftRequest,
    next: { subject: DraftSubject | null; steps: DraftChange[] } | null,
  ): Promise<boolean> => {
    const mine = ++latest;
    // This request carries the token as it is now; a pending refresh is moot.
    clearTimeout(tokenTimer);
    set({ busy: true, error: null });
    const result = await postDraft(request, get().token);
    if (mine !== latest) return false;
    if (!result.ok) {
      set({ busy: false, error: result.message });
      return false;
    }
    const view = result.data;
    const kept = next ?? {
      subject: view.subject,
      steps: view.steps.map((s): DraftChange =>
        s.kind === 'move'
          ? { kind: 'move', move: s.move }
          : { kind: 'fill', hole: s.hole, value: s.value },
      ),
    };
    set({ ...kept, view, busy: false, answer: undefined });
    showOnCanvas(view);
    return true;
  };

  const change = (steps: DraftChange[]): Promise<boolean> => {
    const { subject } = get();
    if (subject === null) {
      set({ error: 'Start from a subject first' });
      return Promise.resolve(false);
    }
    return send({ subject, steps }, { subject, steps });
  };

  return {
    ...initial,
    start: (subject) => send({ subject, steps: [] }, { subject, steps: [] }),
    apply: (move) => change([...get().steps, { kind: 'move', move }]),
    fill: (hole, value) => change([...get().steps, { kind: 'fill', hole, value }]),
    undo: () => change(get().steps.slice(0, -1)),
    load: (graphql) => send({ graphql }, null),
    refresh: () => (get().subject === null ? Promise.resolve(false) : change(get().steps)),
    run: async () => {
      const { subject, steps, token } = get();
      if (subject === null) return false;
      const mine = ++latest;
      set({ busy: true, error: null });
      const result = await runDraft({ subject, steps }, token);
      if (mine !== latest) return false;
      if (!result.ok) {
        set({ busy: false, error: result.message });
        return false;
      }
      set({ busy: false, answer: result.data.answer });
      return true;
    },
    setToken: (token) => {
      set({ token });
      // Which moves are available depends on the token's scopes; ask once
      // typing settles, not on every keystroke.
      clearTimeout(tokenTimer);
      tokenTimer = setTimeout(() => {
        if (get().subject !== null) void change(get().steps);
      }, TOKEN_SETTLE_MS);
    },
    clear: () => {
      latest++;
      set({ ...initial, token: get().token });
      usePipelineStore.getState().reset();
      usePipelineStore.getState().clearHistory();
    },
    leave: () => {
      latest++;
      set({ ...initial, token: get().token });
    },
  };
});
