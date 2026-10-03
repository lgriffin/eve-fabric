import { create } from 'zustand';
import { applyNodeChanges, type Edge, type OnNodesChange } from '@xyflow/react';
import type { DraftSubject } from '@eve-fabric/fabric';
import {
  getCatalog,
  postDraft,
  runDraft,
  type CatalogCapability,
  type DraftChange,
  type DraftRequest,
  type DraftView,
} from '../services/draft-client.js';
import { enrichNodesWithCatalog, pipelineToFlow } from '../services/pipeline-serializer.js';
import { applyAutoLayout } from '../services/layout-engine.js';
import { startingMode, type CapabilityFlowNode, type Mode } from './types.js';

/**
 * The designer's one store: the question being built, and the canvas that
 * shows it. The question is what the draft started from and the changes
 * made, in order; every change goes to the fabric, which answers with what
 * the draft now offers. The canvas is derived from that answer and holds
 * nothing the question does not, except where its nodes sit.
 */
interface DraftState {
  mode: Mode;
  subject: DraftSubject | null;
  steps: DraftChange[];
  view: DraftView | null;
  /** An EVE SSO access token, for moves that need a character's scope. */
  token: string;
  answer: unknown;
  error: string | null;
  busy: boolean;
  /** What the fabric's capabilities look like, so the canvas can name steps and ports. */
  catalog: CatalogCapability[];
  nodes: CapabilityFlowNode[];
  edges: Edge[];
  selectedNodeId: string | null;
}

interface DraftActions {
  setMode: (mode: Mode) => void;
  start: (subject: DraftSubject) => Promise<boolean>;
  apply: (move: string) => Promise<boolean>;
  fill: (hole: string, value: unknown) => Promise<boolean>;
  undo: () => Promise<boolean>;
  /** Opens a saved question, read-only. */
  load: (graphql: string) => Promise<boolean>;
  run: () => Promise<boolean>;
  /** Asks the fabric again, after it changed (a weave was added). */
  refresh: () => Promise<boolean>;
  setToken: (token: string) => void;
  clear: () => void;
  loadCatalog: () => Promise<boolean>;
  /** Dragging a node about does not change the question, only where it sits. */
  onNodesChange: OnNodesChange<CapabilityFlowNode>;
  selectNode: (nodeId: string | null) => void;
  relayout: () => void;
}

/** How long typing in the token field waits before asking the fabric again. */
const TOKEN_SETTLE_MS = 300;

const initial: DraftState = {
  mode: 'explore',
  subject: null,
  steps: [],
  view: null,
  token: '',
  answer: undefined,
  error: null,
  busy: false,
  catalog: [],
  nodes: [],
  edges: [],
  selectedNodeId: null,
};

/** The draft's pipeline as a laid-out canvas; fields read off a port label the edge. */
function canvasOf(
  view: DraftView,
  catalog: CatalogCapability[],
): { nodes: CapabilityFlowNode[]; edges: Edge[] } {
  const { nodes, edges } = pipelineToFlow(view.pipeline);
  const byId = new Map(
    catalog.map((c) => [
      c.id,
      { name: c.name, source: c.source, inputs: [...c.inputs], outputs: [...c.outputs] },
    ]),
  );
  const ported: Edge[] = edges.map((edge) => {
    const [port = '', ...fields] = (edge.sourceHandle ?? '').split('.');
    return fields.length === 0 ? edge : { ...edge, sourceHandle: port, label: fields.join('.') };
  });
  return { nodes: applyAutoLayout(enrichNodesWithCatalog(nodes, byId), ported), edges: ported };
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
    mode: Mode,
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
    set({
      ...kept,
      view,
      mode,
      busy: false,
      answer: undefined,
      selectedNodeId: null,
      ...canvasOf(view, get().catalog),
    });
    return true;
  };

  /** A change keeps the mode it is made in; Explore and Build both build. */
  const change = (steps: DraftChange[]): Promise<boolean> => {
    const { subject, mode } = get();
    if (subject === null) {
      set({ error: 'Start from a subject first' });
      return Promise.resolve(false);
    }
    return send({ subject, steps }, { subject, steps }, mode);
  };

  return {
    ...initial,
    mode: startingMode(),
    setMode: (mode) => set({ mode }),
    // Starting a question is building one; Explore stays Explore until the canvas is asked for.
    start: (subject) => {
      const mode = get().mode === 'review' ? 'build' : get().mode;
      return send({ subject, steps: [] }, { subject, steps: [] }, mode);
    },
    apply: (move) => change([...get().steps, { kind: 'move', move }]),
    fill: (hole, value) => change([...get().steps, { kind: 'fill', hole, value }]),
    undo: () => change(get().steps.slice(0, -1)),
    load: (graphql) => send({ graphql }, null, 'review'),
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
      set({ ...initial, token: get().token, catalog: get().catalog });
    },
    loadCatalog: async () => {
      const result = await getCatalog();
      if (!result.ok) {
        set({ error: `The gateway did not answer: ${result.message}` });
        return false;
      }
      const catalog = result.data.capabilities;
      const { view } = get();
      set({ catalog, ...(view === null ? {} : canvasOf(view, catalog)) });
      return true;
    },
    onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
    selectNode: (selectedNodeId) => set({ selectedNodeId }),
    relayout: () => set({ nodes: applyAutoLayout(get().nodes, get().edges) }),
  };
});
