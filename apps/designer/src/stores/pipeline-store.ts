import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import type { PipelineDefinition } from '@eve-fabric/domain';
import type { CompilerDiagnostic, ConfiguredValue, NodeExecutionState } from './types.js';
import type { ExecutionPlan } from '@eve-fabric/compiler';
import { useToastStore } from './toast-store.js';
import { withHistory, type HistoryActions } from './history-middleware.js';

export type ExecutionNodeState =
  'idle' | 'queued' | 'executing' | 'completed' | 'failed' | 'skipped';

export interface ExecutionStepMetrics {
  durationMs: number;
  cached: boolean;
  source?: string;
  error?: string;
}

interface ExecutionSession {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stepStatuses: Record<string, ExecutionNodeState>;
  stepResults: Record<string, unknown>;
  stepMetrics: Record<string, ExecutionStepMetrics>;
  outputs: Record<string, unknown>;
  errors: Array<{ stepId: string; message: string; code: string }>;
}

export interface BridgingSuggestion {
  sourceNodeId: string;
  sourcePortName: string;
  targetNodeId: string;
  targetPortName: string;
  suggestedCapabilityId: string;
  suggestedCapabilityName: string;
  sourceType: string;
  targetType: string;
}

export interface CapabilityNodeData {
  capabilityId: string;
  capabilityVersion: string;
  label: string;
  source: string;
  inputs: Array<{ name: string; semanticType: string; required: boolean }>;
  outputs: Array<{ name: string; semanticType: string }>;
  [key: string]: unknown;
}

export type CapabilityFlowNode = Node<CapabilityNodeData, 'capability'>;

export interface DrilldownEntry {
  capabilityId: string;
  version: string;
  pipelineDef: PipelineDefinition | null;
}

interface PipelineState {
  nodes: CapabilityFlowNode[];
  edges: Edge[];
  pipelineId: string;
  pipelineName: string;
  pipelineVersion: number;
  diagnostics: CompilerDiagnostic[];
  isDirty: boolean;
  selectedNodeId: string | null;
  compiledPlan: ExecutionPlan | null;
  graphqlSdl: string | null;
  executionSession: ExecutionSession | null;
  bridgingSuggestions: BridgingSuggestion[];
  drilldownStack: DrilldownEntry[];
  isPublishing: boolean;
  nodeConfiguredValues: Record<string, Record<string, ConfiguredValue>>;
  nodeExecutionStates: Record<string, NodeExecutionState>;
}

interface PipelineActions {
  onNodesChange: OnNodesChange<CapabilityFlowNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: CapabilityFlowNode) => void;
  removeNode: (nodeId: string) => void;
  setDiagnostics: (diagnostics: CompilerDiagnostic[]) => void;
  setPipeline: (definition: PipelineDefinition) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setPipelineMeta: (meta: { id?: string; name?: string; version?: number }) => void;
  setCompiledPlan: (plan: ExecutionPlan | null) => void;
  setGraphqlSdl: (sdl: string | null) => void;
  setExecutionSession: (session: ExecutionSession | null) => void;
  updateStepStatus: (
    stepId: string,
    status: ExecutionNodeState,
    metrics?: ExecutionStepMetrics,
  ) => void;
  setBridgingSuggestions: (suggestions: BridgingSuggestion[]) => void;
  setExecutionOutputs: (outputs: Record<string, unknown>) => void;
  loadPipeline: (
    nodes: CapabilityFlowNode[],
    edges: Edge[],
    meta: { id: string; name: string; version: number },
  ) => void;
  openComposite: (entry: DrilldownEntry) => void;
  closeComposite: () => void;
  publishAsCapability: (options: {
    capabilityId: string;
    version: string;
    name: string;
    description: string;
    selectedInputs: string[];
    selectedOutputs: string[];
  }) => Promise<{ success: boolean; diagnostics: Array<{ message: string }> }>;
  reset: () => void;
  setNodeInputValue: (nodeId: string, portName: string, value: ConfiguredValue) => void;
  clearNodeInputValue: (nodeId: string, portName: string) => void;
  setNodeExecutionState: (nodeId: string, state: NodeExecutionState) => void;
}

const initialState: PipelineState = {
  nodes: [],
  edges: [],
  pipelineId: '',
  pipelineName: 'Untitled Pipeline',
  pipelineVersion: 1,
  diagnostics: [],
  isDirty: false,
  selectedNodeId: null,
  compiledPlan: null,
  graphqlSdl: null,
  executionSession: null,
  bridgingSuggestions: [],
  drilldownStack: [],
  isPublishing: false,
  nodeConfiguredValues: {},
  nodeExecutionStates: {},
};

export const usePipelineStore = create<PipelineState & PipelineActions & HistoryActions>()(
  withHistory(
    (set, get) => ({
      ...initialState,

      onNodesChange: (changes) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
          isDirty: true,
        });
      },

      onEdgesChange: (changes) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
          isDirty: true,
        });
      },

      onConnect: (connection: Connection) => {
        set({
          edges: addEdge(connection, get().edges),
          isDirty: true,
        });
      },

      addNode: (node) => {
        set({
          nodes: [...get().nodes, node],
          isDirty: true,
        });
      },

      removeNode: (nodeId) => {
        const configuredValues = { ...get().nodeConfiguredValues };
        delete configuredValues[nodeId];
        const executionStates = { ...get().nodeExecutionStates };
        delete executionStates[nodeId];
        set({
          nodes: get().nodes.filter((n) => n.id !== nodeId),
          edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          nodeConfiguredValues: configuredValues,
          nodeExecutionStates: executionStates,
          isDirty: true,
        });
      },

      setDiagnostics: (diagnostics) => {
        set({ diagnostics });
      },

      setPipeline: (_definition) => {
        set({ isDirty: false });
      },

      setSelectedNode: (nodeId) => {
        set({ selectedNodeId: nodeId });
      },

      setPipelineMeta: (meta) => {
        set({
          pipelineId: meta.id ?? get().pipelineId,
          pipelineName: meta.name ?? get().pipelineName,
          pipelineVersion: meta.version ?? get().pipelineVersion,
          isDirty: true,
        });
      },

      setCompiledPlan: (plan) => {
        set({ compiledPlan: plan });
      },

      setGraphqlSdl: (sdl) => {
        set({ graphqlSdl: sdl });
      },

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
            stepMetrics: metrics
              ? { ...session.stepMetrics, [stepId]: metrics }
              : session.stepMetrics,
          },
        });
      },

      setBridgingSuggestions: (suggestions) => {
        set({ bridgingSuggestions: suggestions });
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

      loadPipeline: (nodes, edges, meta) => {
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
              .addToast(
                'success',
                'Published',
                `Capability ${options.name} published successfully`,
              );
          } else {
            useToastStore
              .getState()
              .addToast(
                'error',
                'Publish failed',
                result.diagnostics.map((d) => d.message).join('; '),
              );
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
        set(initialState);
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

      setNodeExecutionState: (nodeId, state) => {
        set({
          nodeExecutionStates: {
            ...get().nodeExecutionStates,
            [nodeId]: state,
          },
        });
      },
    }),
    { maxEntries: 50 },
  ),
);
