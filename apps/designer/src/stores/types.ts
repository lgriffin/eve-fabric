import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react';
import type { PipelineDefinition } from '@eve-fabric/domain';
import type { ExecutionPlan } from '@eve-fabric/compiler';

/* ---------------------------------------------------------------- */
/* Core domain / entity types                                        */
/* ---------------------------------------------------------------- */

export interface CompilerDiagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: {
    nodeId?: string;
    edgeFrom?: string;
    edgeTo?: string;
    field?: string;
  };
  context?: {
    expectedType?: string;
    actualType?: string;
    capability?: string;
    suggestion?: string;
  };
}

export interface ConfiguredValue {
  value: unknown;
  displayLabel: string;
}

export interface NodeExecutionState {
  status: 'idle' | 'running' | 'success' | 'error';
  resultCount: number | null;
  durationMs: number | null;
  source: string | null;
  cached: boolean;
  error: string | null;
  preview: unknown;
}

export type PaletteMode = 'discover' | 'recommended' | 'all';

export type ToastSeverity = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: string;
  severity: ToastSeverity;
  title: string;
  message: string;
  dismissible: boolean;
  autoDismissMs: number;
  createdAt: number;
}

export type ExecutionNodeState =
  'idle' | 'queued' | 'executing' | 'completed' | 'failed' | 'skipped';

export interface ExecutionStepMetrics {
  durationMs: number;
  cached: boolean;
  source?: string;
  error?: string;
}

export interface ExecutionSession {
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

/* ---------------------------------------------------------------- */
/* Slice state & action shapes (composed into the pipeline store)    */
/* ---------------------------------------------------------------- */

export interface CanvasSliceState {
  nodes: CapabilityFlowNode[];
  edges: Edge[];
  selectedNodeId: string | null;
}

export interface CanvasSliceActions {
  onNodesChange: OnNodesChange<CapabilityFlowNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: CapabilityFlowNode) => void;
  removeNode: (nodeId: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
}

export interface CompilationSliceState {
  diagnostics: CompilerDiagnostic[];
  compiledPlan: ExecutionPlan | null;
  graphqlSdl: string | null;
  bridgingSuggestions: BridgingSuggestion[];
}

export interface CompilationSliceActions {
  setDiagnostics: (diagnostics: CompilerDiagnostic[]) => void;
  setCompiledPlan: (plan: ExecutionPlan | null) => void;
  setGraphqlSdl: (sdl: string | null) => void;
  setBridgingSuggestions: (suggestions: BridgingSuggestion[]) => void;
}

export interface ExecutionSliceState {
  executionSession: ExecutionSession | null;
  nodeExecutionStates: Record<string, NodeExecutionState>;
}

export interface ExecutionSliceActions {
  setExecutionSession: (session: ExecutionSession | null) => void;
  updateStepStatus: (
    stepId: string,
    status: ExecutionNodeState,
    metrics?: ExecutionStepMetrics,
  ) => void;
  setExecutionOutputs: (outputs: Record<string, unknown>) => void;
  setNodeExecutionState: (nodeId: string, state: NodeExecutionState) => void;
}

export interface PersistenceSliceState {
  pipelineId: string;
  pipelineName: string;
  pipelineVersion: number;
  isDirty: boolean;
  isPublishing: boolean;
  drilldownStack: DrilldownEntry[];
  nodeConfiguredValues: Record<string, Record<string, ConfiguredValue>>;
}

export interface PersistenceSliceActions {
  setPipeline: (definition: PipelineDefinition) => void;
  setPipelineMeta: (meta: { id?: string; name?: string; version?: number }) => void;
  loadPipeline: (
    nodes: CapabilityFlowNode[],
    edges: Edge[],
    meta: { id: string; name: string; version: number },
    configuredValues?: Record<string, Record<string, ConfiguredValue>>,
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
}

/* ---------------------------------------------------------------- */
/* Composed store shape + set/get context for slice factories        */
/* ---------------------------------------------------------------- */

export type PipelineState = CanvasSliceState &
  CanvasSliceActions &
  CompilationSliceState &
  CompilationSliceActions &
  ExecutionSliceState &
  ExecutionSliceActions &
  PersistenceSliceState &
  PersistenceSliceActions;

/* Structural set/get that slice factories depend on. Deliberately
   independent of any specific zustand export so it stays compatible
   across zustand v4/v5; the real set/get zustand injects satisfy these
   shapes (its partial-updater overload uses `replace?: false`). */
export type PipelineSet = (
  partial: PipelineState | Partial<PipelineState>,
  replace?: false,
) => void;
export type PipelineGet = () => PipelineState;

/* ---------------------------------------------------------------- */
/* Initial state (one const per slice -> four single-responsibility  */
/* slices: canvas / compilation / execution / persistence (T042))    */
/* ---------------------------------------------------------------- */

export const canvasInitial = {
  nodes: [] as CapabilityFlowNode[],
  edges: [] as Edge[],
  selectedNodeId: null as string | null,
};

export const compilationInitial = {
  diagnostics: [] as CompilerDiagnostic[],
  compiledPlan: null as ExecutionPlan | null,
  graphqlSdl: null as string | null,
  bridgingSuggestions: [] as BridgingSuggestion[],
};

export const executionInitial = {
  executionSession: null as ExecutionSession | null,
  nodeExecutionStates: {} as Record<string, NodeExecutionState>,
};

export const persistenceInitial = {
  pipelineId: '' as string,
  pipelineName: 'Untitled Pipeline' as string,
  pipelineVersion: 1 as number,
  isDirty: false as boolean,
  isPublishing: false as boolean,
  drilldownStack: [] as DrilldownEntry[],
  nodeConfiguredValues: {} as Record<string, Record<string, ConfiguredValue>>,
};
