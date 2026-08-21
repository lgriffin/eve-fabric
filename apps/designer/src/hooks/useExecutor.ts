import { useCallback } from 'react';
import {
  usePipelineStore,
  type ExecutionNodeState,
  type ExecutionStepMetrics,
} from '../stores/pipeline-store.js';
import type { NodeExecutionState } from '../stores/types.js';
import { flowToPipeline } from '../services/pipeline-serializer.js';
import { useToastStore } from '../stores/toast-store.js';

function mapStepStatus(status: string | undefined): 'success' | 'error' {
  if (status === 'failed') return 'error';
  return 'success';
}

export interface ValidationError {
  nodeId: string;
  nodeName: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ExecuteOptions {
  inputs?: Record<string, unknown>;
  stream?: boolean;
}

export function useExecutor() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const pipelineId = usePipelineStore((s) => s.pipelineId);
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const pipelineVersion = usePipelineStore((s) => s.pipelineVersion);
  const setExecutionSession = usePipelineStore((s) => s.setExecutionSession);
  const updateStepStatus = usePipelineStore((s) => s.updateStepStatus);
  const setExecutionOutputs = usePipelineStore((s) => s.setExecutionOutputs);
  const nodeConfiguredValues = usePipelineStore((s) => s.nodeConfiguredValues);
  const setNodeExecutionState = usePipelineStore((s) => s.setNodeExecutionState);
  const addToast = useToastStore((s) => s.addToast);

  const validate = useCallback((): ValidationResult => {
    const errors: ValidationError[] = [];
    const configValues = nodeConfiguredValues;

    for (const node of nodes) {
      for (const input of node.data.inputs) {
        if (!input.required) continue;
        const isConnected = edges.some(
          (e) => e.target === node.id && e.targetHandle === input.name,
        );
        const isConfigured = configValues[node.id]?.[input.name] != null;
        if (!isConnected && !isConfigured) {
          errors.push({
            nodeId: node.id,
            nodeName: node.data.label,
            message: `Missing required input: ${input.name}`,
          });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }, [nodes, edges, nodeConfiguredValues]);

  const execute = useCallback(
    async (options?: ExecuteOptions) => {
      const definition = flowToPipeline(
        nodes,
        edges,
        { id: pipelineId || 'untitled', name: pipelineName, version: pipelineVersion },
        [],
        nodes.length > 0
          ? [
              {
                name: 'result',
                source: `${nodes[nodes.length - 1]!.id}.${nodes[nodes.length - 1]!.data.outputs[0]?.name ?? 'output'}`,
              },
            ]
          : [],
      );

      const sessionId = `exec-${Date.now()}`;
      const stepStatuses: Record<string, ExecutionNodeState> = {};
      for (const node of nodes) {
        stepStatuses[node.id] = 'queued';
      }

      setExecutionSession({
        id: sessionId,
        status: 'running',
        stepStatuses,
        stepResults: {},
        stepMetrics: {},
        outputs: {},
        errors: [],
      });

      // Set all nodes to running state
      for (const node of nodes) {
        setNodeExecutionState(node.id, {
          status: 'running',
          resultCount: null,
          durationMs: null,
          source: null,
          cached: false,
          error: null,
          preview: null,
        });
      }

      if (options?.stream !== false) {
        try {
          const res = await fetch(`/api/pipelines/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pipeline: definition,
              inputs: options?.inputs ?? {},
              nodeConfiguredValues,
            }),
          });

          if (!res.ok) {
            const errorData = (await res
              .json()
              .catch(() => ({ error: { message: `HTTP ${res.status}` } }))) as {
              error?: {
                message?: string;
                code?: string;
                details?: Array<{ code: string; message: string; severity: string }>;
              };
            };
            const errorMsg = errorData.error?.message ?? `Execution failed: ${res.status}`;
            console.error('[useExecutor] Pipeline execution failed:', {
              status: res.status,
              code: errorData.error?.code,
              message: errorMsg,
              diagnostics: errorData.error?.details,
            });
            addToast('error', 'Execution failed', errorMsg);
            setExecutionSession({
              id: sessionId,
              status: 'failed',
              stepStatuses,
              stepResults: {},
              stepMetrics: {},
              outputs: {},
              errors: [
                {
                  stepId: '',
                  message: errorMsg,
                  code: 'EXECUTION_FAILED',
                },
              ],
            });
            return;
          }

          const data = (await res.json()) as {
            outputs: Record<string, unknown>;
            steps?: Array<{
              stepId: string;
              capabilityId: string;
              status: string;
              durationMs: number;
              cached: boolean;
            }>;
            metrics?: {
              stepDurations?: Record<string, number>;
              totalDurationMs?: number;
              cacheHits?: number;
              cacheMisses?: number;
            };
            stepStatuses?: Record<string, string>;
            errors?: Array<{ stepId: string; message: string; code: string }>;
          };

          if (data.stepStatuses) {
            for (const [stepId, status] of Object.entries(data.stepStatuses)) {
              const metrics: ExecutionStepMetrics = {
                durationMs: data.metrics?.stepDurations?.[stepId] ?? 0,
                cached: false,
              };
              updateStepStatus(stepId, status as ExecutionNodeState, metrics);
            }
          }

          for (const node of nodes) {
            if (!data.stepStatuses?.[node.id] || data.stepStatuses[node.id] === 'completed') {
              updateStepStatus(node.id, 'completed', {
                durationMs: data.metrics?.stepDurations?.[node.id] ?? 0,
                cached: false,
              });
            }
          }

          // Update per-node execution states from steps array (T056)
          if (data.steps) {
            for (const step of data.steps) {
              const nodeState: NodeExecutionState = {
                status: step.status === 'completed' ? 'success' : 'error',
                resultCount: null,
                durationMs: step.durationMs,
                source: null,
                cached: step.cached,
                error: step.status !== 'completed' ? `Step failed: ${step.status}` : null,
                preview: data.outputs?.[step.stepId] ?? null,
              };
              setNodeExecutionState(step.stepId, nodeState);
            }
          } else {
            // Fallback: use stepStatuses if no steps array
            for (const node of nodes) {
              const status = data.stepStatuses?.[node.id];
              const nodeState: NodeExecutionState = {
                status: mapStepStatus(status),
                resultCount: null,
                durationMs: data.metrics?.stepDurations?.[node.id] ?? null,
                source: null,
                cached: false,
                error: null,
                preview: data.outputs?.[node.id] ?? null,
              };
              setNodeExecutionState(node.id, nodeState);
            }
          }

          if (data.errors && data.errors.length > 0) {
            for (const err of data.errors) {
              updateStepStatus(err.stepId, 'failed', {
                durationMs: 0,
                cached: false,
                error: err.message,
              });
              setNodeExecutionState(err.stepId, {
                status: 'error',
                resultCount: null,
                durationMs: null,
                source: null,
                cached: false,
                error: err.message,
                preview: null,
              });
            }
          }

          setExecutionOutputs(data.outputs ?? {});
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Network error';
          addToast('error', 'Execution failed', errorMsg);
          for (const node of nodes) {
            setNodeExecutionState(node.id, {
              status: 'error',
              resultCount: null,
              durationMs: null,
              source: null,
              cached: false,
              error: err instanceof Error ? err.message : 'Network error',
              preview: null,
            });
          }
          setExecutionSession({
            id: sessionId,
            status: 'failed',
            stepStatuses,
            stepResults: {},
            stepMetrics: {},
            outputs: {},
            errors: [
              {
                stepId: '',
                message: err instanceof Error ? err.message : 'Network error',
                code: 'NETWORK_ERROR',
              },
            ],
          });
        }
      }
    },
    [
      nodes,
      edges,
      pipelineId,
      pipelineName,
      pipelineVersion,
      nodeConfiguredValues,
      setExecutionSession,
      updateStepStatus,
      setExecutionOutputs,
      setNodeExecutionState,
      addToast,
    ],
  );

  const cancelExecution = useCallback(() => {
    const session = usePipelineStore.getState().executionSession;
    if (session && session.status === 'running') {
      setExecutionSession({ ...session, status: 'cancelled' });
    }
  }, [setExecutionSession]);

  return { execute, validate, cancelExecution };
}
