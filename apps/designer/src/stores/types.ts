import type { Node, Edge, OnNodesChange } from '@xyflow/react';
import type { PipelineDefinition } from '@eve-fabric/core';

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

/**
 * The canvas shows the open question's scaffold. Nothing here changes the
 * question: nodes move, a node is selected, a composite is opened to look
 * inside, and the whole scaffold is replaced when the question changes.
 */
export interface CanvasState {
  nodes: CapabilityFlowNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  drilldownStack: DrilldownEntry[];
}

export interface CanvasActions {
  onNodesChange: OnNodesChange<CapabilityFlowNode>;
  setSelectedNode: (nodeId: string | null) => void;
  /** Shows a scaffold in place of the one on the canvas. */
  loadPipeline: (nodes: CapabilityFlowNode[], edges: Edge[]) => void;
  openComposite: (entry: DrilldownEntry) => void;
  closeComposite: () => void;
  reset: () => void;
}

export type PipelineState = CanvasState & CanvasActions;

export type PipelineSet = (partial: PipelineState | Partial<PipelineState>) => void;
export type PipelineGet = () => PipelineState;

export const canvasInitial: CanvasState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  drilldownStack: [],
};
