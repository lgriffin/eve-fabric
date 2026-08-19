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
import type { CompilerDiagnostic } from './types.js';

export interface CapabilityNodeData {
  capabilityId: string;
  capabilityVersion: number;
  label: string;
  source: string;
  inputs: Array<{ name: string; semanticType: string; required: boolean }>;
  outputs: Array<{ name: string; semanticType: string }>;
  [key: string]: unknown;
}

export type CapabilityFlowNode = Node<CapabilityNodeData, 'capability'>;

export interface PipelineState {
  nodes: CapabilityFlowNode[];
  edges: Edge[];
  pipelineId: string;
  pipelineName: string;
  pipelineVersion: number;
  diagnostics: CompilerDiagnostic[];
  isDirty: boolean;
  selectedNodeId: string | null;
}

export interface PipelineActions {
  onNodesChange: OnNodesChange<CapabilityFlowNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: CapabilityFlowNode) => void;
  removeNode: (nodeId: string) => void;
  setDiagnostics: (diagnostics: CompilerDiagnostic[]) => void;
  setPipeline: (definition: PipelineDefinition) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setPipelineMeta: (meta: { id?: string; name?: string; version?: number }) => void;
  reset: () => void;
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
};

export const usePipelineStore = create<PipelineState & PipelineActions>()((set, get) => ({
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
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
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

  reset: () => {
    set(initialState);
  },
}));
